import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../database/database.constants.js';
import type { Review, ReviewStatus } from '../types/review.type.js';
import type { ReviewRepository } from './review-repository.interface.js';

export type ReviewDB = {
  id: string;
  repository: string;
  pull_request_number: number;
  status: ReviewStatus;
};

@Injectable()
export class PostgresReviewRepository implements ReviewRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  async findAll(): Promise<Review[]> {
    const result = await this.pool.query<ReviewDB>('SELECT * FROM reviews');

    return result.rows.map((item): Review => {
      return {
        id: item.id,
        repository: item.repository,
        status: item.status,
        pullRequestNumber: item.pull_request_number,
      };
    });
  }
}
