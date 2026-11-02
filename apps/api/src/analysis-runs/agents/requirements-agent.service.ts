import { Inject, Injectable } from '@nestjs/common';
import type OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { zodTextFormat } from 'openai/helpers/zod';

import { OPENAI_CLIENT } from '../../ai/ai.constants.js';
import { requirementsAnalysisResultSchema } from './requirements-agent.schema.js';
import type { RequirementsAnalysisResult } from './requirements-agent.types.js';

@Injectable()
export class RequirementsAgent {
  constructor(
    @Inject(OPENAI_CLIENT)
    private readonly openai: OpenAI,

    private readonly configService: ConfigService,
  ) {}

  async analyze(input: string): Promise<RequirementsAnalysisResult> {
    const model = this.configService.getOrThrow<string>('OPENAI_MODEL');

    const response = await this.openai.responses.parse({
      model,
      input: [
        {
          role: 'system',
          content: `
You are a requirements analysis agent.

Analyze the provided software change and identify requirement-related problems.

Return only findings supported by the provided input.
Do not invent missing information.

Confidence must be between 0 and 1.
          `.trim(),
        },
        {
          role: 'user',
          content: input,
        },
      ],
      text: {
        format: zodTextFormat(
          requirementsAnalysisResultSchema,
          'requirements_analysis',
        ),
      },
    });

    const parsed = response.output_parsed;

    if (!parsed) {
      throw new Error(
        `Requirements agent returned no parsed output. Response status: ${response.status}`,
      );
    }

    return parsed;
  }
}
