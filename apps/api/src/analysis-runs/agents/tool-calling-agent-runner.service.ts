import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

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

export type ToolCallingAgentConfig = {
  agentType: AgentType;
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

    let response = await this.openai.responses.parse({
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

      response = await this.openai.responses.parse({
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
}
