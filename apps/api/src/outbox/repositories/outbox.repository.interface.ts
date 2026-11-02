import type { PoolClient } from 'pg';
import type {
  NewOutboxEvent,
  OutboxEvent,
} from '../types/outbox-event.type.js';

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

export interface OutboxRepository {
  save(event: NewOutboxEvent, client?: PoolClient): Promise<OutboxEvent>;

  findPending(limit: number, client?: PoolClient): Promise<OutboxEvent[]>;

  markPublished(
    id: string,
    client?: PoolClient,
  ): Promise<OutboxEvent | undefined>;
}
