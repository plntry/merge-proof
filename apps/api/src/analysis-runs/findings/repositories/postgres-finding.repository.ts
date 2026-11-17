import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../../database/database.constants.js';
import type { Finding, NewFinding } from '../finding.types.js';
import type { FindingRepository } from './finding-repository.interface.js';
import type { FindingSeverity } from '../../agents/requirements-agent.types.js';

type FindingRow = {
  id: string;
  analysis_run_id: string;
  agent_run_id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
  created_at: Date;
};

@Injectable()
export class PostgresFindingRepository implements FindingRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  private mapRowToFinding(row: FindingRow): Finding {
    return {
      id: row.id,
      analysisRunId: row.analysis_run_id,
      agentRunId: row.agent_run_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      confidence: row.confidence,
      createdAt: row.created_at,
    };
  }

  async replaceForAgentRun(
    agentRunId: string,
    findings: NewFinding[],
  ): Promise<Finding[]> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM findings
       WHERE agent_run_id = $1;`,
        [agentRunId],
      );

      const saved: Finding[] = [];

      for (const finding of findings) {
        const result = await client.query<FindingRow>(
          `INSERT INTO findings (
          id,
          analysis_run_id,
          agent_run_id,
          title,
          description,
          severity,
          confidence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;`,
          [
            finding.id,
            finding.analysisRunId,
            finding.agentRunId,
            finding.title,
            finding.description,
            finding.severity,
            finding.confidence,
          ],
        );

        saved.push(this.mapRowToFinding(result.rows[0]));
      }

      await client.query('COMMIT');

      return saved;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findByAnalysisRunId(analysisRunId: string): Promise<Finding[]> {
    const result = await this.pool.query<FindingRow>(
      `SELECT *
       FROM findings
       WHERE analysis_run_id = $1
       ORDER BY created_at ASC;`,
      [analysisRunId],
    );

    return result.rows.map((row) => this.mapRowToFinding(row));
  }
}
