import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { performance } from 'node:perf_hooks';

import { OPENAI_CLIENT } from '../../ai/ai.constants.js';
import { TOOL_LIMITS } from '../tools/tool.constants.js';
import { ToolRegistry } from '../tools/tool-registry.service.js';
import { getOpenAiToolDefinitions } from '../tools/openai-tool-definitions.js';
import { agentAnalysisResultSchema } from './analysis-agent.schema.js';
import type {
  AgentAnalysisResult,
  AgentExecutionContext,
  AgentType,
} from './analysis-agent.types.js';
import type { ToolName } from '../tools/tool.types.js';
import { TraceRecorder } from '../tracing/trace-recorder.service.js';

export type ToolCallingAgentConfig = {
  agentType: AgentType;
  promptVersion: string;
  instructions: string;
  allowedTools: readonly ToolName[];
};

@Injectable()
export class ToolCallingAgentRunner {
  constructor(
    @Inject(OPENAI_CLIENT)
    private readonly openai: OpenAI,
    private readonly configService: ConfigService,
    private readonly toolRegistry: ToolRegistry,
    private readonly traceRecorder: TraceRecorder,
  ) {}

  async run(
    context: AgentExecutionContext,
    config: ToolCallingAgentConfig,
  ): Promise<AgentAnalysisResult> {
    const model = this.configService.getOrThrow<string>('OPENAI_MODEL');
    const tools = getOpenAiToolDefinitions(config.allowedTools);
    const text = {
      format: zodTextFormat(
        agentAnalysisResultSchema,
        `${config.agentType}_analysis`,
      ),
    } as const;

    let requestIndex = 0;
    let response = await this.request(context, config, requestIndex++, model, {
      model,
      instructions: config.instructions,
      input: `Analyze repository ${context.repository}, pull request #${context.pullRequestNumber}.`,
      tools,
      tool_choice: 'required',
      text,
    });
    let toolCallIterations = 0;

    while (true) {
      const toolCalls = response.output.filter(
        (item) => item.type === 'function_call',
      );

      if (toolCalls.length === 0) {
        if (!response.output_parsed) {
          throw new Error(
            `${config.agentType} agent returned no parsed output. Response status: ${response.status}`,
          );
        }

        return agentAnalysisResultSchema.parse(response.output_parsed);
      }

      if (toolCallIterations >= TOOL_LIMITS.maxToolCallIterations) {
        throw new Error(
          `${config.agentType} agent exceeded ${TOOL_LIMITS.maxToolCallIterations} tool-call iterations.`,
        );
      }

      toolCallIterations += 1;
      const toolOutputs: Array<{
        type: 'function_call_output';
        call_id: string;
        output: string;
      }> = [];

      for (const toolCall of toolCalls) {
        const result = await this.toolRegistry.execute(
          {
            analysisRunId: context.analysisRunId,
            agentRunId: context.agentRunId,
            agentType: config.agentType,
            repository: context.repository,
            pullRequestNumber: context.pullRequestNumber,
          },
          toolCall.name,
          toolCall.arguments,
        );

        toolOutputs.push({
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: JSON.stringify(result),
        });
      }

      response = await this.request(context, config, requestIndex++, model, {
        model,
        instructions: config.instructions,
        previous_response_id: response.id,
        input: toolOutputs,
        tools,
        tool_choice: 'auto',
        text,
      });
    }
  }

  private async request(
    context: AgentExecutionContext,
    config: ToolCallingAgentConfig,
    requestIndex: number,
    model: string,
    body: Parameters<OpenAI['responses']['parse']>[0],
  ): Promise<Awaited<ReturnType<OpenAI['responses']['parse']>>> {
    await this.traceRecorder.record({
      analysisRunId: context.analysisRunId,
      agentRunId: context.agentRunId,
      toolCallId: null,
      eventType: 'model.request.started',
      metadata: {
        agentType: config.agentType,
        promptVersion: config.promptVersion,
        requestIndex,
        model,
      },
    });
    const startedAt = performance.now();

    try {
      const response = await this.openai.responses.parse(body);
      const usage = (
        response as unknown as {
          usage?: {
            input_tokens: number;
            output_tokens: number;
            total_tokens: number;
          } | null;
        }
      ).usage;
      await this.traceRecorder.record({
        analysisRunId: context.analysisRunId,
        agentRunId: context.agentRunId,
        toolCallId: null,
        eventType: 'model.request.completed',
        metadata: {
          agentType: config.agentType,
          promptVersion: config.promptVersion,
          requestIndex,
          model,
          durationMs: Math.round(performance.now() - startedAt),
          inputTokens: usage?.input_tokens ?? null,
          outputTokens: usage?.output_tokens ?? null,
          totalTokens: usage?.total_tokens ?? null,
        },
      });
      return response;
    } catch (error) {
      await this.traceRecorder.record({
        analysisRunId: context.analysisRunId,
        agentRunId: context.agentRunId,
        toolCallId: null,
        eventType: 'model.request.failed',
        metadata: {
          agentType: config.agentType,
          promptVersion: config.promptVersion,
          requestIndex,
          model,
          durationMs: Math.round(performance.now() - startedAt),
          errorType: error instanceof Error ? error.name : 'unknown',
        },
      });
      throw error;
    }
  }
}
