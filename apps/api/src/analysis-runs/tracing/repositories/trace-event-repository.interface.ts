import type { PoolClient } from 'pg';
import type { NewTraceEvent, TraceEvent } from '../trace-event.types.js';

export const TRACE_EVENT_REPOSITORY = Symbol('TRACE_EVENT_REPOSITORY');

export interface TraceEventRepository {
  append(event: NewTraceEvent, client?: PoolClient): Promise<TraceEvent>;
  findByAnalysisRunId(analysisRunId: string): Promise<TraceEvent[]>;
  findByAgentRunId(agentRunId: string): Promise<TraceEvent[]>;
}
