import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  ANALYSIS_QUEUE,
  ANALYZE_REVIEW_JOB,
} from './analysis-runs.constants.js';

export type AnalysisJobData = {
  analysisRunId: string;
};

@Injectable()
export class AnalysisQueueService {
  constructor(
    @InjectQueue(ANALYSIS_QUEUE)
    private readonly analysisQueue: Queue<AnalysisJobData>,
  ) {}

  async enqueueAnalysis(analysisRunId: string): Promise<void> {
    await this.analysisQueue.add(ANALYZE_REVIEW_JOB, {
      analysisRunId,
    });
  }
}
