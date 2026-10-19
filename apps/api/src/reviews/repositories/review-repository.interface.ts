import { type PoolClient } from 'pg';
import type { Review } from '../types/review.type.js';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface ReviewRepository {
  findAll(): Promise<Review[]>;

  findById(id: string): Promise<Review | undefined>;

  save(review: Review, client?: PoolClient): Promise<Review>;

  update(review: Review): Promise<Review | undefined>;

  remove(id: string): Promise<boolean>;
}
