import type {
  AgentType,
  FindingSeverity,
} from '../agents/analysis-agent.types.js';

export type NewFinding = {
  id: string;
  analysisRunId: string;
  agentRunId: string;
  sourceIndex: number;
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
};

export type Finding = NewFinding & {
  createdAt: Date;
};

export type FindingWithAgentType = Finding & {
  agentType: AgentType;
};
