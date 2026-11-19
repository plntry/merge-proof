import type { AgentRunStatus } from '../agents/agent-run.types.js';
import type {
  AgentType,
  FindingSeverity,
} from '../agents/analysis-agent.types.js';
import type { AnalysisRunStatus } from '../types/analysis-run.type.js';
import type { TraceEvent } from './trace-event.types.js';

export type TokenUsageSummary = {
  usageComplete: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type TraceSeverityCounts = Record<FindingSeverity, number>;

export type AgentTraceSummary = TokenUsageSummary & {
  agentRunId: string;
  agentType: AgentType;
  status: AgentRunStatus;
  model: string;
  promptVersion: string | null;
  reused: boolean;
  durationMs: number | null;
  findingCount: number;
  severityCounts: TraceSeverityCounts;
  modelCallCount: number;
  toolCallCount: number;
};

export type AnalysisTraceSummary = {
  analysisRunId: string;
  status: AnalysisRunStatus;
  totalDurationMs: number | null;
  attempts: number;
  retries: number;
  agents: AgentTraceSummary[];
  totals: TokenUsageSummary & {
    executedAgents: number;
    reusedAgents: number;
    failedAgents: number;
    modelCalls: number;
    toolCalls: number;
    findings: number;
    severityCounts: TraceSeverityCounts;
  };
};

export type AnalysisTrace = {
  summary: AnalysisTraceSummary;
  events: TraceEvent[];
};
