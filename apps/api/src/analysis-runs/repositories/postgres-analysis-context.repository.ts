import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { DATABASE_POOL } from '../../database/database.constants.js';
import type {
  AnalysisContextRepository,
  AnalysisReviewContext,
} from './analysis-context-repository.interface.js';

type AnalysisReviewContextRow = {
  analysis_run_id: string;
  review_id: string;
  repository: string;
  pull_request_number: number;
};

@Injectable()
export class PostgresAnalysisContextRepository
  implements AnalysisContextRepository
{
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  async findByAnalysisRunId(
    analysisRunId: string,
  ): Promise<AnalysisReviewContext | undefined> {
    const result = await this.pool.query<AnalysisReviewContextRow>(
      `SELECT
         analysis_runs.id AS analysis_run_id,
         reviews.id AS review_id,
         reviews.repository,
         reviews.pull_request_number
       FROM analysis_runs
       INNER JOIN reviews ON reviews.id = analysis_runs.review_id
       WHERE analysis_runs.id = $1;`,
      [analysisRunId],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return {
      analysisRunId: row.analysis_run_id,
      reviewId: row.review_id,
      repository: row.repository,
      pullRequestNumber: row.pull_request_number,
    };
  }
}
