import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AGENT_TYPES } from '../agents/analysis-agent.types.js';
import {
  AGENT_RUN_REPOSITORY,
  type AgentRunRepository,
} from '../agents/repositories/agent-run.repository.interface.js';
import {
  ANALYSIS_RUN_REPOSITORY,
  type AnalysisRunRepository,
} from '../repositories/analysis-run-repository.interface.js';
import {
  FINDING_REPOSITORY,
  type FindingRepository,
} from '../findings/repositories/finding-repository.interface.js';
import {
  MERGE_ASSESSMENT_REPOSITORY,
  type MergeAssessmentRepository,
} from '../merge-assessment/repositories/merge-assessment-repository.interface.js';
import type { AnalysisLiveSnapshot } from './analysis-live.types.js';

@Injectable()
export class AnalysisLiveService {
  constructor(
    @Inject(ANALYSIS_RUN_REPOSITORY)
    private readonly analysisRuns: AnalysisRunRepository,
    @Inject(AGENT_RUN_REPOSITORY)
    private readonly agentRuns: AgentRunRepository,
    @Inject(FINDING_REPOSITORY)
    private readonly findings: FindingRepository,
    @Inject(MERGE_ASSESSMENT_REPOSITORY)
    private readonly assessments: MergeAssessmentRepository,
  ) {}

  async snapshot(id: string): Promise<AnalysisLiveSnapshot> {
    const run = await this.analysisRuns.findById(id);
    if (!run) throw new NotFoundException(`Analysis run ${id} not found`);
    const [agents, findings, assessment] = await Promise.all([
      this.agentRuns.findByAnalysisRunId(id),
      this.findings.findByAnalysisRunId(id),
      this.assessments.findByAnalysisRunId(id),
    ]);
    const byType = new Map(agents.map((agent) => [agent.agentType, agent.status]));
    const updatedAt = [run.startedAt, run.completedAt, ...agents.map((agent) => agent.completedAt)]
      .filter((date): date is Date => date !== null)
      .reduce((latest, date) => date > latest ? date : latest, run.createdAt);

    return {
      analysisRun: { id: run.id, status: run.status, attemptCount: run.attemptCount },
      agents: AGENT_TYPES.map((type) => ({ type, status: byType.get(type) ?? 'waiting' })),
      assessment: assessment ? { decision: assessment.decision, riskScore: assessment.riskScore } : null,
      findingCount: findings.length,
      updatedAt: updatedAt.toISOString(),
    };
  }
}
