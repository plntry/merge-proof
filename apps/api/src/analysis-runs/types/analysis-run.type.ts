export const ANALYSIS_RUN_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'needs_review',
] as const;

export type AnalysisRunStatus = (typeof ANALYSIS_RUN_STATUSES)[number];

export type NewAnalysisRun = {
  id: string;
  reviewId: string;
  status: AnalysisRunStatus;
};

export type AnalysisRun = NewAnalysisRun & {
  attemptCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
};
