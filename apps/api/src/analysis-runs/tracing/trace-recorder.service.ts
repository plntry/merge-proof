import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

import {
  TRACE_EVENT_REPOSITORY,
  type TraceEventRepository,
} from './repositories/trace-event-repository.interface.js';
import type { RecordTraceEvent } from './trace-event.types.js';

@Injectable()
export class TraceRecorder {
  private readonly logger = new Logger(TraceRecorder.name);

  constructor(
    @Inject(TRACE_EVENT_REPOSITORY)
    private readonly repository: TraceEventRepository,
  ) {}

  async record(event: RecordTraceEvent, client?: PoolClient): Promise<void> {
    try {
      await this.repository.append({ id: randomUUID(), ...event }, client);
    } catch (error) {
      this.logger.warn({
        message: 'Trace event could not be persisted',
        analysisRunId: event.analysisRunId,
        agentRunId: event.agentRunId,
        toolCallId: event.toolCallId,
        eventType: event.eventType,
        errorType: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
}
