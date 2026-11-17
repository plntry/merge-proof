import type { FindingSeverity } from '../agents/requirements-agent.types.js';

export type NewFinding = {
  id: string;
  analysisRunId: string;
  agentRunId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
};

export type Finding = NewFinding & {
  createdAt: Date;
};
