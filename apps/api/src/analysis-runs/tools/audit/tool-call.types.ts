export const TOOL_CALL_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;

export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number];

export type NewToolCall = {
  id: string;
  agentRunId: string;
  toolName: string;
  arguments: unknown;
  status: ToolCallStatus;
};

export type ToolCall = NewToolCall & {
  result: unknown;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};
