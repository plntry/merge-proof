import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  FINDING_REPOSITORY,
  type FindingRepository,
} from './repositories/finding-repository.interface.js';

import { agentAnalysisResultSchema } from '../agents/analysis-agent.schema.js';
import { TraceRecorder } from '../tracing/trace-recorder.service.js';

@Injectable()
export class FindingProjectionService {
  constructor(
    @Inject(FINDING_REPOSITORY)
    private readonly findingRepository: FindingRepository,
    private readonly traceRecorder: TraceRecorder,
  ) {}

  async projectAgentOutput(
    analysisRunId: string,
    agentRunId: string,
    output: unknown,
  ): Promise<number> {
    const parsed = agentAnalysisResultSchema.parse(output);

    const findings = parsed.findings.map((finding, sourceIndex) => ({
      id: randomUUID(),
      analysisRunId,
      agentRunId,
      sourceIndex,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      confidence: finding.confidence,
    }));

    await this.findingRepository.preserveForAgentRun(agentRunId, findings);
    await this.traceRecorder.record({
      analysisRunId,
      agentRunId,
      toolCallId: null,
      eventType: 'findings.projected',
      metadata: { findingCount: findings.length },
    });

    return findings.length;
  }
}
