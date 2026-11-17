export const AGENT_RUN_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;

export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const AGENT_TYPES = ['requirements'] as const;

export type AgentType = (typeof AGENT_TYPES)[number];

export type NewAgentRun = {
  id: string;
  analysisRunId: string;
  agentType: AgentType;
  status: AgentRunStatus;
  model: string;
};

export type AgentRun = NewAgentRun & {
  output: unknown | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};
