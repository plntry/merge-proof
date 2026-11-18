import { Inject, Injectable } from '@nestjs/common';
import type OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { zodTextFormat } from 'openai/helpers/zod';

import { OPENAI_CLIENT } from '../../ai/ai.constants.js';
import { requirementsAnalysisResultSchema } from './requirements-agent.schema.js';
import type {
  RequirementsAnalysisInput,
  RequirementsAnalysisResult,
} from './requirements-agent.types.js';
import { ToolRegistry } from '../tools/tool-registry.service.js';
import { REQUIREMENTS_AGENT_TOOLS } from '../tools/openai-tool-definitions.js';
import { TOOL_LIMITS } from '../tools/tool.constants.js';

@Injectable()
export class RequirementsAgent {
  constructor(
    @Inject(OPENAI_CLIENT)
    private readonly openai: OpenAI,

    private readonly configService: ConfigService,

    private readonly toolRegistry: ToolRegistry,
  ) {}

  async analyze(
    input: RequirementsAnalysisInput,
  ): Promise<RequirementsAnalysisResult> {
    const model = this.configService.getOrThrow<string>('OPENAI_MODEL');
    const instructions = `
You are a requirements analysis agent.

Analyze the pull request for requirement-related problems. Use only the provided
repository tools, and only for the repository and pull request under review.
Before returning findings, inspect the pull request metadata and changed-file list,
then inspect relevant changed files or repository references as needed.

Tool errors are controlled data. Recover when possible and do not invent unavailable
information. Return only findings supported by tool evidence. Confidence must be
between 0 and 1.
    `.trim();
    const text = {
      format: zodTextFormat(
        requirementsAnalysisResultSchema,
        'requirements_analysis',
      ),
    } as const;

    let response = await this.openai.responses.parse({
      model,
      instructions,
      input: `Analyze repository ${input.repository}, pull request #${input.pullRequestNumber}.`,
      tools: REQUIREMENTS_AGENT_TOOLS,
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
            `Requirements agent returned no parsed output. Response status: ${response.status}`,
          );
        }

        return requirementsAnalysisResultSchema.parse(response.output_parsed);
      }

      if (toolCallIterations >= TOOL_LIMITS.maxToolCallIterations) {
        throw new Error(
          `Requirements agent exceeded ${TOOL_LIMITS.maxToolCallIterations} tool-call iterations.`,
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
          input,
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
        instructions,
        previous_response_id: response.id,
        input: toolOutputs,
        tools: REQUIREMENTS_AGENT_TOOLS,
        tool_choice: 'auto',
        text,
      });
    }
  }
}
