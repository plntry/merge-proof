import { Inject, Injectable } from '@nestjs/common';
import type {
  AnalysisRequestedPayload,
  NewOutboxEvent,
  OutboxEvent,
  OutboxEventStatus,
  OutboxEventType,
} from '../types/outbox-event.type.js';
import { DATABASE_POOL } from '../../database/database.constants.js';
import type { Pool, PoolClient } from 'pg';
import type { OutboxRepository } from './outbox.repository.interface.js';

type OutboxEventRow = {
  id: string;
  event_type: OutboxEventType;
  aggregate_id: string;
  payload: AnalysisRequestedPayload;
  status: OutboxEventStatus;
  created_at: Date;
  published_at: Date | null;
};

@Injectable()
export class PostgresOutboxRepository implements OutboxRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  private mapRowToOutboxEvent(row: OutboxEventRow): OutboxEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      payload: row.payload,
      status: row.status,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    };
  }

  async save(event: NewOutboxEvent, client?: PoolClient): Promise<OutboxEvent> {
    const db = client ?? this.pool;

    const result = await db.query<OutboxEventRow>(
      `INSERT INTO outbox_events (
        id,
        event_type,
        aggregate_id,
        payload,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;`,
      [
        event.id,
        event.eventType,
        event.aggregateId,
        event.payload,
        event.status,
      ],
    );

    const row = result.rows[0];

    return this.mapRowToOutboxEvent(row);
  }
}
