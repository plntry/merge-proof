import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { DATABASE_POOL } from '../../../database/database.constants.js';
import type {
  NewToolCall,
  ToolCall,
  ToolCallStatus,
} from './tool-call.types.js';
import type { ToolCallRepository } from './tool-call-repository.interface.js';

type ToolCallRow = {
  id: string;
  agent_run_id: string;
  tool_name: string;
  arguments: unknown;
  result: unknown;
  status: ToolCallStatus;
  error_message: string | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
};

@Injectable()
export class PostgresToolCallRepository implements ToolCallRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  private mapRow(row: ToolCallRow): ToolCall {
    return {
      id: row.id,
      agentRunId: row.agent_run_id,
      toolName: row.tool_name,
      arguments: row.arguments,
      result: row.result,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  async findByAgentRunIds(agentRunIds: string[]): Promise<ToolCall[]> {
    if (agentRunIds.length === 0) return [];
    const result = await this.pool.query<ToolCallRow>(
      `SELECT * FROM tool_calls
       WHERE agent_run_id = ANY($1::uuid[])
       ORDER BY created_at ASC;`,
      [agentRunIds],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async save(toolCall: NewToolCall): Promise<ToolCall> {
    const result = await this.pool.query<ToolCallRow>(
      `INSERT INTO tool_calls (
        id,
        agent_run_id,
        tool_name,
        arguments,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;`,
      [
        toolCall.id,
        toolCall.agentRunId,
        toolCall.toolName,
        JSON.stringify(toolCall.arguments),
        toolCall.status,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async markRunning(id: string): Promise<ToolCall | undefined> {
    const result = await this.pool.query<ToolCallRow>(
      `UPDATE tool_calls
       SET status = 'running', started_at = NOW()
       WHERE id = $1
       RETURNING *;`,
      [id],
    );

    const row = result.rows[0];
    return row ? this.mapRow(row) : undefined;
  }

  async markCompleted(
    id: string,
    toolResult: unknown,
  ): Promise<ToolCall | undefined> {
    const result = await this.pool.query<ToolCallRow>(
      `UPDATE tool_calls
       SET
         status = 'completed',
         result = $2,
         completed_at = NOW(),
         error_message = NULL
       WHERE id = $1
       RETURNING *;`,
      [id, JSON.stringify(toolResult)],
    );

    const row = result.rows[0];
    return row ? this.mapRow(row) : undefined;
  }

  async markFailed(
    id: string,
    errorMessage: string,
  ): Promise<ToolCall | undefined> {
    const result = await this.pool.query<ToolCallRow>(
      `UPDATE tool_calls
       SET
         status = 'failed',
         completed_at = NOW(),
         error_message = $2
       WHERE id = $1
       RETURNING *;`,
      [id, errorMessage],
    );

    const row = result.rows[0];
    return row ? this.mapRow(row) : undefined;
  }
}
