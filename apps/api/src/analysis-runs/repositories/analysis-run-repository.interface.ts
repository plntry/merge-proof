import type { PoolClient } from 'pg';
import type {
  AnalysisRun,
  NewAnalysisRun,
} from '../types/analysis-run.type.js';

export const ANALYSIS_RUN_REPOSITORY = Symbol('ANALYSIS_RUN_REPOSITORY');

export interface AnalysisRunRepository {
  save(run: NewAnalysisRun, client?: PoolClient): Promise<AnalysisRun>;

  findById(id: string, client?: PoolClient): Promise<AnalysisRun | undefined>;

  lockById(id: string, client: PoolClient): Promise<AnalysisRun | undefined>;

  markRunning(
    id: string,
    expectedAttemptCount: number,
  ): Promise<AnalysisRun | undefined>;

  markCompleted(id: string): Promise<AnalysisRun | undefined>;

  markNeedsReview(
    id: string,
    errorMessage: string,
  ): Promise<AnalysisRun | undefined>;

  markFailed(
    id: string,
    errorMessage: string,
  ): Promise<AnalysisRun | undefined>;
}
