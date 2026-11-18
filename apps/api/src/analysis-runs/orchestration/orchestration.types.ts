import type { AgentType } from '../agents/analysis-agent.types.js';

export type AgentExecutionSummary = {
  agentType: AgentType;
  status: 'completed' | 'failed';
  findingCount: number;
  errorMessage?: string;
};

export type AnalysisOrchestrationResult = {
  agents: AgentExecutionSummary[];
  completedAgents: AgentType[];
  failedAgents: AgentType[];
};
