import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../../database/database.constants.js';
import type {
  MergeAssessmentSummary,
  MergeDecision,
  MergeDecisionReason,
} from '../../merge-decision/merge-decision.types.js';
import type {
  MergeAssessment,
  NewMergeAssessment,
} from '../merge-assessment.types.js';
import type { MergeAssessmentRepository } from './merge-assessment-repository.interface.js';

type MergeAssessmentRow = {
  id: string;
  analysis_run_id: string;
  decision: MergeDecision;
  risk_score: number;
  reasons: MergeDecisionReason[];
  summary: MergeAssessmentSummary;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class PostgresMergeAssessmentRepository implements MergeAssessmentRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  private mapRow(row: MergeAssessmentRow): MergeAssessment {
    return {
      id: row.id,
      analysisRunId: row.analysis_run_id,
      decision: row.decision,
      riskScore: row.risk_score,
      reasons: row.reasons,
      summary: row.summary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByAnalysisRunId(
    analysisRunId: string,
    client?: PoolClient,
  ): Promise<MergeAssessment | undefined> {
    const db = client ?? this.pool;
    const result = await db.query<MergeAssessmentRow>(
      `SELECT * FROM merge_assessments WHERE analysis_run_id = $1;`,
      [analysisRunId],
    );
    const row = result.rows[0];
    return row ? this.mapRow(row) : undefined;
  }

  async upsert(
    assessment: NewMergeAssessment,
    client?: PoolClient,
  ): Promise<MergeAssessment> {
    const db = client ?? this.pool;
    const result = await db.query<MergeAssessmentRow>(
      `INSERT INTO merge_assessments (
         id,
         analysis_run_id,
         decision,
         risk_score,
         reasons,
         summary
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (analysis_run_id)
       DO UPDATE SET
         decision = EXCLUDED.decision,
         risk_score = EXCLUDED.risk_score,
         reasons = EXCLUDED.reasons,
         summary = EXCLUDED.summary,
         updated_at = NOW()
       RETURNING *;`,
      [
        assessment.id,
        assessment.analysisRunId,
        assessment.decision,
        assessment.riskScore,
        JSON.stringify(assessment.reasons),
        JSON.stringify(assessment.summary),
      ],
    );
    return this.mapRow(result.rows[0]);
  }
}
