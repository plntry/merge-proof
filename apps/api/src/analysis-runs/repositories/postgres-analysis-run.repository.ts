import { Inject, Injectable } from '@nestjs/common';
import type {
  AnalysisRun,
  AnalysisRunStatus,
  NewAnalysisRun,
} from '../types/analysis-run.type.js';
import type { AnalysisRunRepository } from './analysis-run-repository.interface.js';
import { DATABASE_POOL } from '../../database/database.constants.js';
import type { Pool, PoolClient } from 'pg';

type AnalysisRunRow = {
  id: string;
  review_id: string;
  status: AnalysisRunStatus;
  attempt_count: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
};

@Injectable()
export class PostgresAnalysisRunRepository implements AnalysisRunRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  private mapRowToAnalysisRun(row: AnalysisRunRow): AnalysisRun {
    return {
      id: row.id,
      reviewId: row.review_id,
      status: row.status,
      attemptCount: row.attempt_count,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
    };
  }

  async save(
    analysisRun: NewAnalysisRun,
    client?: PoolClient,
  ): Promise<AnalysisRun> {
    const db = client ?? this.pool;

    const result = await db.query<AnalysisRunRow>(
      `INSERT INTO analysis_runs (
        id,
        review_id,
        status
      )
      VALUES ($1, $2, $3)
      RETURNING *;`,
      [analysisRun.id, analysisRun.reviewId, analysisRun.status],
    );

    const row = result.rows[0];

    return this.mapRowToAnalysisRun(row);
  }

  async findById(id: string): Promise<AnalysisRun | undefined> {
    const result = await this.pool.query<AnalysisRunRow>(
      `SELECT *
      FROM analysis_runs
      WHERE id = $1;`,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToAnalysisRun(row);
  }

  // updates
  async markRunning(id: string): Promise<AnalysisRun | undefined> {
    const result = await this.pool.query<AnalysisRunRow>(
      `UPDATE analysis_runs
        SET
          status = 'running',
          attempt_count = attempt_count + 1,
          started_at = NOW(),
          error_message = NULL
        WHERE id = $1
        RETURNING *;`,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToAnalysisRun(row);
  }

  async markCompleted(id: string): Promise<AnalysisRun | undefined> {
    const result = await this.pool.query<AnalysisRunRow>(
      `UPDATE analysis_runs
        SET
          status = 'completed',
          completed_at = NOW(),
          error_message = NULL
        WHERE id = $1
        RETURNING *;`,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToAnalysisRun(row);
  }

  async markFailed(
    id: string,
    errorMessage: string,
  ): Promise<AnalysisRun | undefined> {
    const result = await this.pool.query<AnalysisRunRow>(
      `UPDATE analysis_runs
        SET
          status = 'failed',
          completed_at = NOW(),
          error_message = $1
        WHERE id = $2
        RETURNING *;`,
      [errorMessage, id],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToAnalysisRun(row);
  }
}
