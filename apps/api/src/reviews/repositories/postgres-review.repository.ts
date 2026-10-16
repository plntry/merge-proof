import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../database/database.constants.js';
import type { Review, ReviewStatus } from '../types/review.type.js';
import type { ReviewRepository } from './review-repository.interface.js';

type ReviewRow = {
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

  private mapRowToReview(row: ReviewRow): Review {
    return {
      id: row.id,
      repository: row.repository,
      status: row.status,
      pullRequestNumber: row.pull_request_number,
    };
  }

  async findAll(): Promise<Review[]> {
    const result = await this.pool.query<ReviewRow>('SELECT * FROM reviews ');

    return result.rows.map((item): Review => this.mapRowToReview(item));
  }

  async findById(id: string): Promise<Review | undefined> {
    const result = await this.pool.query<ReviewRow>(
      'SELECT * FROM reviews WHERE id = $1',
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToReview(row);
  }

  async save(review: Review): Promise<Review> {
    const result = await this.pool.query<ReviewRow>(
      `INSERT INTO reviews (
        id,
        repository,
        pull_request_number,
        status
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;`,
      [review.id, review.repository, review.pullRequestNumber, review.status],
    );

    const row = result.rows[0];

    return this.mapRowToReview(row);
  }

  async update(review: Review): Promise<Review | undefined> {
    const result = await this.pool.query<ReviewRow>(
      `UPDATE reviews
      SET
        repository = $2,
        pull_request_number = $3,
        status = $4
      WHERE id = $1
      RETURNING *;`,
      [review.id, review.repository, review.pullRequestNumber, review.status],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToReview(row);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM reviews WHERE id = $1;`, [
      id,
    ]);

    return result.rowCount === 1;
  }
}
