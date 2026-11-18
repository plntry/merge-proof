import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  FINDING_REPOSITORY,
  type FindingRepository,
} from './repositories/finding-repository.interface.js';

import { agentAnalysisResultSchema } from '../agents/analysis-agent.schema.js';

@Injectable()
export class FindingProjectionService {
  constructor(
    @Inject(FINDING_REPOSITORY)
    private readonly findingRepository: FindingRepository,
  ) {}

  async projectAgentOutput(
    analysisRunId: string,
    agentRunId: string,
    output: unknown,
  ): Promise<number> {
    const parsed = agentAnalysisResultSchema.parse(output);

    const findings = parsed.findings.map((finding) => ({
      id: randomUUID(),
      analysisRunId,
      agentRunId,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      confidence: finding.confidence,
    }));

    await this.findingRepository.replaceForAgentRun(agentRunId, findings);

    return findings.length;
  }
}
