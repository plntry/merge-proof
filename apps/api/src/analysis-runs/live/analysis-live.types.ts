import type { AgentType } from '../agents/analysis-agent.types.js';
import type { AgentRunStatus } from '../agents/agent-run.types.js';
import type { AnalysisRun, AnalysisRunStatus } from '../types/analysis-run.type.js';
import type { MergeDecision } from '../merge-decision/merge-decision.types.js';

export type AnalysisLiveSnapshot = {
  analysisRun: {
    id: string;
    status: AnalysisRunStatus;
    attemptCount: number;
  };
  agents: Array<{ type: AgentType; status: AgentRunStatus | 'waiting' }>;
  assessment: { decision: MergeDecision; riskScore: number } | null;
  findingCount: number;
  updatedAt: string;
};

export const LIVE_TERMINAL_STATUSES: AnalysisRunStatus[] = [
  'completed',
  'failed',
  'needs_review',
];

export type AnalysisRunForLive = AnalysisRun;
