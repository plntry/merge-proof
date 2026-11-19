import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../../database/database.constants.js';
import type {
  AgentRun,
  AgentRunStatus,
  NewAgentRun,
} from '../agent-run.types.js';
import type { AgentType } from '../analysis-agent.types.js';
import { AgentRunRepository } from './agent-run.repository.interface.js';

type AgentRunRow = {
  id: string;
  analysis_run_id: string;
  agent_type: AgentType;
  status: AgentRunStatus;
  model: string;
  output: unknown;
  error_message: string | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
};

@Injectable()
export class PostgresAgentRunRepository implements AgentRunRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  private mapRowToAgentRun(row: AgentRunRow): AgentRun {
    return {
      id: row.id,
      analysisRunId: row.analysis_run_id,
      agentType: row.agent_type,
      status: row.status,
      model: row.model,
      output: row.output,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  async findOrCreate(run: NewAgentRun, client?: PoolClient): Promise<AgentRun> {
    const db = client ?? this.pool;

    const result = await db.query<AgentRunRow>(
      `INSERT INTO agent_runs (
        id,
        analysis_run_id,
        agent_type,
        status,
        model
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (analysis_run_id, agent_type)
      DO UPDATE SET model = agent_runs.model
      RETURNING *;`,
      [run.id, run.analysisRunId, run.agentType, run.status, run.model],
    );

    return this.mapRowToAgentRun(result.rows[0]);
  }

  async findByAnalysisRunAndType(
    analysisRunId: string,
    agentType: AgentType,
  ): Promise<AgentRun | undefined> {
    const result = await this.pool.query<AgentRunRow>(
      `SELECT *
       FROM agent_runs
       WHERE analysis_run_id = $1
         AND agent_type = $2;`,
      [analysisRunId, agentType],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToAgentRun(row);
  }

  async findByAnalysisRunId(
    analysisRunId: string,
    client?: PoolClient,
  ): Promise<AgentRun[]> {
    const db = client ?? this.pool;
    const result = await db.query<AgentRunRow>(
      `SELECT *
       FROM agent_runs
       WHERE analysis_run_id = $1
       ORDER BY created_at ASC;`,
      [analysisRunId],
    );
    return result.rows.map((row) => this.mapRowToAgentRun(row));
  }

  async markRunning(id: string): Promise<AgentRun | undefined> {
    const result = await this.pool.query<AgentRunRow>(
      `UPDATE agent_runs
       SET
         status = 'running',
         started_at = COALESCE(started_at, NOW()),
         completed_at = NULL,
         error_message = NULL
       WHERE id = $1
         AND status IN ('pending', 'failed')
       RETURNING *;`,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToAgentRun(row);
  }

  async markCompleted(
    id: string,
    output: unknown,
  ): Promise<AgentRun | undefined> {
    const result = await this.pool.query<AgentRunRow>(
      `UPDATE agent_runs
       SET
         status = 'completed',
         output = $2,
         completed_at = NOW(),
         error_message = NULL
       WHERE id = $1
         AND status = 'running'
       RETURNING *;`,
      [id, output],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToAgentRun(row);
  }

  async markFailed(
    id: string,
    errorMessage: string,
  ): Promise<AgentRun | undefined> {
    const result = await this.pool.query<AgentRunRow>(
      `UPDATE agent_runs
       SET
         status = 'failed',
         completed_at = NOW(),
         error_message = $2
       WHERE id = $1
         AND status = 'running'
       RETURNING *;`,
      [id, errorMessage],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.mapRowToAgentRun(row);
  }
}
