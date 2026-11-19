import type { PoolClient } from 'pg';

import type {
  MergeAssessment,
  NewMergeAssessment,
} from '../merge-assessment.types.js';

export const MERGE_ASSESSMENT_REPOSITORY = Symbol(
  'MERGE_ASSESSMENT_REPOSITORY',
);

export interface MergeAssessmentRepository {
  findByAnalysisRunId(
    analysisRunId: string,
    client?: PoolClient,
  ): Promise<MergeAssessment | undefined>;

  upsert(
    assessment: NewMergeAssessment,
    client?: PoolClient,
  ): Promise<MergeAssessment>;
}
