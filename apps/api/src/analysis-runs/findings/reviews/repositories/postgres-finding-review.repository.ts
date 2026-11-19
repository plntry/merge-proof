import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../../../database/database.constants.js';
import type { FindingSeverity } from '../../../agents/analysis-agent.types.js';
import type {
  FindingReview,
  FindingReviewStatus,
  NewFindingReview,
} from '../finding-review.types.js';
import type { FindingReviewRepository } from './finding-review-repository.interface.js';

type FindingReviewRow = {
  id: string;
  finding_id: string;
  status: FindingReviewStatus;
  edited_title: string | null;
  edited_description: string | null;
  edited_severity: FindingSeverity | null;
  review_note: string | null;
  reviewed_by: string | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class PostgresFindingReviewRepository implements FindingReviewRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  private mapRow(row: FindingReviewRow): FindingReview {
    return {
      id: row.id,
      findingId: row.finding_id,
      status: row.status,
      editedTitle: row.edited_title,
      editedDescription: row.edited_description,
      editedSeverity: row.edited_severity,
      reviewNote: row.review_note,
      reviewedBy: row.reviewed_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByFindingId(
    findingId: string,
    client?: PoolClient,
  ): Promise<FindingReview | undefined> {
    const db = client ?? this.pool;
    const result = await db.query<FindingReviewRow>(
      `SELECT * FROM finding_reviews WHERE finding_id = $1;`,
      [findingId],
    );
    const row = result.rows[0];
    return row ? this.mapRow(row) : undefined;
  }

  async findByFindingIds(
    findingIds: string[],
    client?: PoolClient,
  ): Promise<FindingReview[]> {
    if (findingIds.length === 0) return [];
    const db = client ?? this.pool;
    const result = await db.query<FindingReviewRow>(
      `SELECT *
       FROM finding_reviews
       WHERE finding_id = ANY($1::uuid[]);`,
      [findingIds],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async upsert(
    review: NewFindingReview,
    client?: PoolClient,
  ): Promise<FindingReview> {
    const db = client ?? this.pool;
    const result = await db.query<FindingReviewRow>(
      `INSERT INTO finding_reviews (
         id,
         finding_id,
         status,
         edited_title,
         edited_description,
         edited_severity,
         review_note,
         reviewed_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (finding_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         edited_title = EXCLUDED.edited_title,
         edited_description = EXCLUDED.edited_description,
         edited_severity = EXCLUDED.edited_severity,
         review_note = EXCLUDED.review_note,
         reviewed_by = EXCLUDED.reviewed_by,
         updated_at = NOW()
       RETURNING *;`,
      [
        review.id,
        review.findingId,
        review.status,
        review.editedTitle,
        review.editedDescription,
        review.editedSeverity,
        review.reviewNote,
        review.reviewedBy,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async deleteByFindingId(
    findingId: string,
    client?: PoolClient,
  ): Promise<boolean> {
    const db = client ?? this.pool;
    const result = await db.query(
      `DELETE FROM finding_reviews WHERE finding_id = $1;`,
      [findingId],
    );
    return result.rowCount === 1;
  }
}
