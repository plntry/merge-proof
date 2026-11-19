import { randomUUID } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../database/database.constants.js';
import { AGENT_TYPES } from '../agents/analysis-agent.types.js';
import {
  AGENT_RUN_REPOSITORY,
  type AgentRunRepository,
} from '../agents/repositories/agent-run.repository.interface.js';
import { EffectiveFindingService } from '../findings/effective/effective-finding.service.js';
import { MergeDecisionEngine } from '../merge-decision/merge-decision-engine.js';
import type { AgentCoverage } from '../merge-decision/merge-decision.types.js';
import {
  ANALYSIS_RUN_REPOSITORY,
  type AnalysisRunRepository,
} from '../repositories/analysis-run-repository.interface.js';
import type { MergeAssessment } from './merge-assessment.types.js';
import {
  MERGE_ASSESSMENT_REPOSITORY,
  type MergeAssessmentRepository,
} from './repositories/merge-assessment-repository.interface.js';
import { TraceRecorder } from '../tracing/trace-recorder.service.js';

@Injectable()
export class MergeAssessmentService {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
    @Inject(ANALYSIS_RUN_REPOSITORY)
    private readonly analysisRunRepository: AnalysisRunRepository,
    @Inject(AGENT_RUN_REPOSITORY)
    private readonly agentRunRepository: AgentRunRepository,
    @Inject(MERGE_ASSESSMENT_REPOSITORY)
    private readonly mergeAssessmentRepository: MergeAssessmentRepository,
    private readonly effectiveFindingService: EffectiveFindingService,
    private readonly engine: MergeDecisionEngine,
    private readonly traceRecorder: TraceRecorder,
  ) {}

  async findByAnalysisRunId(analysisRunId: string): Promise<MergeAssessment> {
    const analysisRun =
      await this.analysisRunRepository.findById(analysisRunId);

    if (!analysisRun) {
      throw new NotFoundException(`Analysis run ${analysisRunId} not found`);
    }

    const assessment =
      await this.mergeAssessmentRepository.findByAnalysisRunId(analysisRunId);

    if (!assessment) {
      throw new NotFoundException(
        `Merge assessment for analysis run ${analysisRunId} not found`,
      );
    }

    return assessment;
  }

  async recalculate(
    analysisRunId: string,
    client?: PoolClient,
  ): Promise<MergeAssessment> {
    if (client) {
      return this.recalculateWithClient(analysisRunId, client);
    }

    const ownedClient = await this.pool.connect();

    try {
      await ownedClient.query('BEGIN');
      const assessment = await this.recalculateWithClient(
        analysisRunId,
        ownedClient,
      );
      await ownedClient.query('COMMIT');
      return assessment;
    } catch (error) {
      await ownedClient.query('ROLLBACK');
      throw error;
    } finally {
      ownedClient.release();
    }
  }

  private async recalculateWithClient(
    analysisRunId: string,
    client: PoolClient,
  ): Promise<MergeAssessment> {
    const analysisRun = await this.analysisRunRepository.lockById(
      analysisRunId,
      client,
    );

    if (!analysisRun) {
      throw new NotFoundException(`Analysis run ${analysisRunId} not found`);
    }

    const [findingStates, agentRuns] = await Promise.all([
      this.effectiveFindingService.findByAnalysisRunId(analysisRunId, client),
      this.agentRunRepository.findByAnalysisRunId(analysisRunId, client),
    ]);
    const statusByAgent = new Map(
      agentRuns.map((run) => [run.agentType, run.status]),
    );
    const agentCoverage: AgentCoverage[] = AGENT_TYPES.map((agentType) => ({
      agentType,
      status:
        statusByAgent.get(agentType) === 'completed' ? 'completed' : 'failed',
    }));
    const result = this.engine.evaluate({
      findings: findingStates.map(({ finding, review }) =>
        this.effectiveFindingService.resolve(finding, review),
      ),
      agentCoverage,
    });

    const assessment = await this.mergeAssessmentRepository.upsert(
      {
        id: randomUUID(),
        analysisRunId,
        ...result,
      },
      client,
    );
    await this.traceRecorder.record(
      {
        analysisRunId,
        agentRunId: null,
        toolCallId: null,
        eventType: 'assessment.calculated',
        metadata: {
          decision: assessment.decision,
          riskScore: assessment.riskScore,
        },
      },
      client,
    );
    return assessment;
  }
}
