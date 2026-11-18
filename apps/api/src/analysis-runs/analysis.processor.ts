import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import {
  ANALYSIS_QUEUE,
  ANALYZE_REVIEW_JOB,
} from './analysis-runs.constants.js';
import type { AnalysisJobData } from './analysis-queue.service.js';
import { AnalysisOrchestrator } from './orchestration/analysis-orchestrator.service.js';
import {
  ANALYSIS_RUN_REPOSITORY,
  type AnalysisRunRepository,
} from './repositories/analysis-run-repository.interface.js';

@Processor(ANALYSIS_QUEUE)
export class AnalysisProcessor extends WorkerHost {
  constructor(
    @Inject(ANALYSIS_RUN_REPOSITORY)
    private readonly analysisRunRepository: AnalysisRunRepository,
    private readonly analysisOrchestrator: AnalysisOrchestrator,
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

    if (!startedRun) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

    try {
      const result = await this.analysisOrchestrator.run(startedRun.id);

      if (result.failedAgents.length === 0) {
        await this.analysisRunRepository.markCompleted(startedRun.id);
        return;
      }

      const failureMessage = `Agents failed: ${result.failedAgents.join(', ')}`;

      if (result.completedAgents.length > 0 && isLastAttempt) {
        await this.analysisRunRepository.markNeedsReview(
          startedRun.id,
          failureMessage,
        );
        return;
      }

      throw new Error(failureMessage);
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      if (isLastAttempt) {
        await this.analysisRunRepository.markFailed(
          startedRun.id,
          normalizedError.message,
        );
      }

      throw normalizedError;
    }
  }
}
