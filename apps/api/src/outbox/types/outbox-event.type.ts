export const OUTBOX_EVENT_STATUSES = ['pending', 'published'] as const;

export type OutboxEventStatus = (typeof OUTBOX_EVENT_STATUSES)[number];

export const OUTBOX_EVENT_TYPES = ['analysis.requested'] as const;

export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[number];

export type AnalysisRequestedPayload = {
  analysisRunId: string;
};

export type NewOutboxEvent = {
  id: string;
  eventType: OutboxEventType;
  aggregateId: string;
  payload: AnalysisRequestedPayload;
  status: OutboxEventStatus;
};

export type OutboxEvent = NewOutboxEvent & {
  createdAt: Date;
  publishedAt: Date | null;
};
