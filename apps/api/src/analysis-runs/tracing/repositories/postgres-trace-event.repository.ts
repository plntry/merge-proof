import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../../database/database.constants.js';
import type {
  NewTraceEvent,
  TraceEvent,
  TraceEventType,
  TraceMetadata,
} from '../trace-event.types.js';
import type { TraceEventRepository } from './trace-event-repository.interface.js';

type TraceEventRow = {
  id: string;
  analysis_run_id: string;
  agent_run_id: string | null;
  tool_call_id: string | null;
  event_type: TraceEventType;
  metadata: TraceMetadata;
  created_at: Date;
};

@Injectable()
export class PostgresTraceEventRepository implements TraceEventRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async append(event: NewTraceEvent, client?: PoolClient): Promise<TraceEvent> {
    const db = client ?? this.pool;
    if (client) await client.query('SAVEPOINT trace_event_append');

    try {
      const result = await db.query<TraceEventRow>(
        `INSERT INTO trace_events (
           id, analysis_run_id, agent_run_id, tool_call_id, event_type, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *;`,
        [
          event.id,
          event.analysisRunId,
          event.agentRunId,
          event.toolCallId,
          event.eventType,
          JSON.stringify(event.metadata),
        ],
      );
      if (client) await client.query('RELEASE SAVEPOINT trace_event_append');
      return this.mapRow(result.rows[0]);
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK TO SAVEPOINT trace_event_append');
        await client.query('RELEASE SAVEPOINT trace_event_append');
      }
      throw error;
    }
  }

  async findByAnalysisRunId(analysisRunId: string): Promise<TraceEvent[]> {
    const result = await this.pool.query<TraceEventRow>(
      `SELECT * FROM trace_events
       WHERE analysis_run_id = $1
       ORDER BY created_at ASC, id ASC;`,
      [analysisRunId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findByAgentRunId(agentRunId: string): Promise<TraceEvent[]> {
    const result = await this.pool.query<TraceEventRow>(
      `SELECT * FROM trace_events
       WHERE agent_run_id = $1
       ORDER BY created_at ASC, id ASC;`,
      [agentRunId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: TraceEventRow): TraceEvent {
    return {
      id: row.id,
      analysisRunId: row.analysis_run_id,
      agentRunId: row.agent_run_id,
      toolCallId: row.tool_call_id,
      eventType: row.event_type,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}
