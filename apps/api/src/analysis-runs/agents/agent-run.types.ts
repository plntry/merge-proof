import type { AgentType } from './analysis-agent.types.js';

export const AGENT_RUN_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;

export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export type NewAgentRun = {
  id: string;
  analysisRunId: string;
  agentType: AgentType;
  status: AgentRunStatus;
  model: string;
};

export type AgentRun = NewAgentRun & {
  output: unknown;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
};
