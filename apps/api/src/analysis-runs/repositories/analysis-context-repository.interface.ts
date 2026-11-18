export const ANALYSIS_CONTEXT_REPOSITORY = Symbol(
  'ANALYSIS_CONTEXT_REPOSITORY',
);

export type AnalysisReviewContext = {
  analysisRunId: string;
  reviewId: string;
  repository: string;
  pullRequestNumber: number;
};

export interface AnalysisContextRepository {
  findByAnalysisRunId(
    analysisRunId: string,
  ): Promise<AnalysisReviewContext | undefined>;
}
