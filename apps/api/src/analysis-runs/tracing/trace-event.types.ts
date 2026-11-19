export const TRACE_EVENT_TYPES = [
  'analysis.started',
  'analysis.completed',
  'analysis.failed',
  'agent.started',
  'agent.completed',
  'agent.failed',
  'agent.reused',
  'model.request.started',
  'model.request.completed',
  'model.request.failed',
  'tool.started',
  'tool.completed',
  'tool.failed',
  'findings.projected',
  'assessment.calculated',
] as const;

export type TraceEventType = (typeof TRACE_EVENT_TYPES)[number];

export type TraceMetadataValue =
  | string
  | number
  | boolean
  | null
  | TraceMetadataValue[]
  | { [key: string]: TraceMetadataValue };

export type TraceMetadata = Record<string, TraceMetadataValue>;

export type NewTraceEvent = {
  id: string;
  analysisRunId: string;
  agentRunId: string | null;
  toolCallId: string | null;
  eventType: TraceEventType;
  metadata: TraceMetadata;
};

export type TraceEvent = NewTraceEvent & {
  createdAt: Date;
};

export type RecordTraceEvent = Omit<NewTraceEvent, 'id'>;
