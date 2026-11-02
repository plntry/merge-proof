import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
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

@Processor(ANALYSIS_QUEUE)
export class AnalysisProcessor extends WorkerHost {
  constructor(
    @Inject(ANALYSIS_RUN_REPOSITORY)
    private readonly analysisRunRepository: AnalysisRunRepository,
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

    try {
      await this.analysisRunRepository.markCompleted(analysisRun.id);
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      const maxAttempts = job.opts.attempts ?? 1;

      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

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
