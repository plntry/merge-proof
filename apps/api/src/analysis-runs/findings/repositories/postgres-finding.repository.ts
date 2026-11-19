import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../../database/database.constants.js';
import type {
  Finding,
  FindingWithAgentType,
  NewFinding,
} from '../finding.types.js';
import type { FindingRepository } from './finding-repository.interface.js';
import type { FindingSeverity } from '../../agents/analysis-agent.types.js';
import type { AgentType } from '../../agents/analysis-agent.types.js';

type FindingRow = {
  id: string;
  analysis_run_id: string;
  agent_run_id: string;
  source_index: number;
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
  created_at: Date;
};

type FindingWithAgentTypeRow = FindingRow & {
  agent_type: AgentType;
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
      sourceIndex: row.source_index,
      title: row.title,
      description: row.description,
      severity: row.severity,
      confidence: row.confidence,
      createdAt: row.created_at,
    };
  }

  async preserveForAgentRun(
    agentRunId: string,
    findings: NewFinding[],
  ): Promise<Finding[]> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const saved: Finding[] = [];

      for (const finding of findings) {
        const result = await client.query<FindingRow>(
          `INSERT INTO findings (
          id,
          analysis_run_id,
          agent_run_id,
          source_index,
          title,
          description,
          severity,
          confidence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (agent_run_id, source_index) DO NOTHING
        RETURNING *;`,
          [
            finding.id,
            finding.analysisRunId,
            finding.agentRunId,
            finding.sourceIndex,
            finding.title,
            finding.description,
            finding.severity,
            finding.confidence,
          ],
        );

        const inserted = result.rows[0];

        if (inserted) {
          saved.push(this.mapRowToFinding(inserted));
          continue;
        }

        const existing = await client.query<FindingRow>(
          `SELECT *
           FROM findings
           WHERE agent_run_id = $1
             AND source_index = $2;`,
          [agentRunId, finding.sourceIndex],
        );

        const existingRow = existing.rows[0];

        if (!existingRow) {
          throw new Error(
            `Finding ${agentRunId}:${finding.sourceIndex} could not be preserved`,
          );
        }

        saved.push(this.mapRowToFinding(existingRow));
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

  async findById(
    id: string,
    client?: PoolClient,
  ): Promise<Finding | undefined> {
    const db = client ?? this.pool;
    const result = await db.query<FindingRow>(
      `SELECT * FROM findings WHERE id = $1;`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.mapRowToFinding(row) : undefined;
  }

  async findByAnalysisRunId(
    analysisRunId: string,
    client?: PoolClient,
  ): Promise<Finding[]> {
    const db = client ?? this.pool;
    const result = await db.query<FindingRow>(
      `SELECT *
       FROM findings
       WHERE analysis_run_id = $1
       ORDER BY created_at ASC;`,
      [analysisRunId],
    );

    return result.rows.map((row) => this.mapRowToFinding(row));
  }

  async findByAnalysisRunIdWithAgentType(
    analysisRunId: string,
    client?: PoolClient,
  ): Promise<FindingWithAgentType[]> {
    const db = client ?? this.pool;
    const result = await db.query<FindingWithAgentTypeRow>(
      `SELECT findings.*, agent_runs.agent_type
       FROM findings
       INNER JOIN agent_runs ON agent_runs.id = findings.agent_run_id
       WHERE findings.analysis_run_id = $1
       ORDER BY findings.created_at ASC, findings.source_index ASC;`,
      [analysisRunId],
    );

    return result.rows.map((row) => ({
      ...this.mapRowToFinding(row),
      agentType: row.agent_type,
    }));
  }
}
