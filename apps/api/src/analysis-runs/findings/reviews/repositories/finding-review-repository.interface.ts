import type { PoolClient } from 'pg';

import type {
  FindingReview,
  NewFindingReview,
} from '../finding-review.types.js';

export const FINDING_REVIEW_REPOSITORY = Symbol('FINDING_REVIEW_REPOSITORY');

export interface FindingReviewRepository {
  findByFindingId(
    findingId: string,
    client?: PoolClient,
  ): Promise<FindingReview | undefined>;

  findByFindingIds(
    findingIds: string[],
    client?: PoolClient,
  ): Promise<FindingReview[]>;

  upsert(review: NewFindingReview, client?: PoolClient): Promise<FindingReview>;

  deleteByFindingId(findingId: string, client?: PoolClient): Promise<boolean>;
}
