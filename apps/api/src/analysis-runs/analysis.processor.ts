import { randomUUID } from 'node:crypto';

import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';

import {
  ANALYSIS_QUEUE,
  ANALYZE_REVIEW_JOB,
} from './analysis-runs.constants.js';

import type { AnalysisJobData } from './analysis-queue.service.js';

import {
  ANALYSIS_RUN_REPOSITORY,
  type AnalysisRunRepository,
} from './repositories/analysis-run-repository.interface.js';

import {
  AGENT_RUN_REPOSITORY,
  type AgentRunRepository,
} from './agents/repositories/agent-run.repository.interface.js';

import type { AgentRun } from './agents/agent-run.types.js';

import { RequirementsAgent } from './agents/requirements-agent.service.js';

import { FindingProjectionService } from './findings/finding-projection.service.js';
import {
  ANALYSIS_CONTEXT_REPOSITORY,
  type AnalysisContextRepository,
} from './repositories/analysis-context-repository.interface.js';

@Processor(ANALYSIS_QUEUE)
export class AnalysisProcessor extends WorkerHost {
  constructor(
    @Inject(ANALYSIS_RUN_REPOSITORY)
    private readonly analysisRunRepository: AnalysisRunRepository,

    @Inject(AGENT_RUN_REPOSITORY)
    private readonly agentRunRepository: AgentRunRepository,

    @Inject(ANALYSIS_CONTEXT_REPOSITORY)
    private readonly analysisContextRepository: AnalysisContextRepository,

    private readonly requirementsAgent: RequirementsAgent,

    private readonly findingProjectionService: FindingProjectionService,

    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<AnalysisJobData>): Promise<void> {
    if (job.name !== ANALYZE_REVIEW_JOB) {
      throw new Error(`Unsupported job: ${job.name}`);
    }

    const analysisRun = await this.analysisRunRepository.findById(
      job.data.analysisRunId,
    );

    if (!analysisRun) {
      throw new Error(`Analysis run ${job.data.analysisRunId} not found`);
    }

    const startedRun = await this.analysisRunRepository.markRunning(
      analysisRun.id,
      job.attemptsMade,
    );

    // Duplicate/stale execution.
    // Another worker/attempt already claimed this run.
    if (!startedRun) {
      return;
    }

    let agentRun: AgentRun | undefined;

    try {
      agentRun = await this.agentRunRepository.findByAnalysisRunAndType(
        startedRun.id,
        'requirements',
      );

      /*
       * AgentRun does not exist yet.
       * Create one, but DON'T call the model yet.
       */
      if (!agentRun) {
        const model = this.configService.getOrThrow<string>('OPENAI_MODEL');

        agentRun = await this.agentRunRepository.save({
          id: randomUUID(),
          analysisRunId: startedRun.id,
          agentType: 'requirements',
          status: 'pending',
          model,
        });
      }

      /*
       * AI already completed in a previous attempt.
       *
       * Important:
       * do NOT call OpenAI again.
       *
       * We can rebuild the normalized findings table
       * from the persisted JSONB output.
       */
      if (agentRun.status === 'completed') {
        if (agentRun.output == null) {
          throw new Error(`Completed agent run ${agentRun.id} has no output`);
        }

        await this.findingProjectionService.projectRequirementsOutput(
          startedRun.id,
          agentRun.id,
          agentRun.output,
        );

        await this.analysisRunRepository.markCompleted(startedRun.id);

        return;
      }

      /*
       * Start requirements agent execution.
       */
      const runningAgentRun = await this.agentRunRepository.markRunning(
        agentRun.id,
      );

      if (!runningAgentRun) {
        throw new Error(`Agent run ${agentRun.id} could not be started`);
      }

      const reviewContext =
        await this.analysisContextRepository.findByAnalysisRunId(startedRun.id);

      if (!reviewContext) {
        throw new Error(
          `Review context for analysis run ${startedRun.id} not found`,
        );
      }

      const result = await this.requirementsAgent.analyze({
        agentRunId: runningAgentRun.id,
        repository: reviewContext.repository,
        pullRequestNumber: reviewContext.pullRequestNumber,
      });

      /*
       * First persist the raw structured AI result.
       *
       * This becomes our audit copy / source of truth.
       */
      const completedAgentRun = await this.agentRunRepository.markCompleted(
        runningAgentRun.id,
        result,
      );

      if (!completedAgentRun) {
        throw new Error(
          `Agent run ${runningAgentRun.id} could not be completed`,
        );
      }

      agentRun = completedAgentRun;

      /*
       * Convert AI JSON output into normalized product data.
       *
       * agent_runs.output:
       * raw/auditable structured AI output
       *
       * findings:
       * normalized rows used by product/UI/scoring
       */
      await this.findingProjectionService.projectRequirementsOutput(
        startedRun.id,
        completedAgentRun.id,
        result,
      );

      await this.analysisRunRepository.markCompleted(startedRun.id);
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      const maxAttempts = job.opts.attempts ?? 1;

      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      /*
       * Don't change a successfully completed AgentRun
       * back to failed just because projection/persistence
       * failed afterwards.
       */
      if (isLastAttempt) {
        if (agentRun && agentRun.status !== 'completed') {
          await this.agentRunRepository.markFailed(
            agentRun.id,
            normalizedError.message,
          );
        }

        await this.analysisRunRepository.markFailed(
          startedRun.id,
          normalizedError.message,
        );
      }

      /*
       * Important:
       * rethrow so BullMQ knows this attempt failed
       * and can retry it.
       */
      throw normalizedError;
    }
  }
}
