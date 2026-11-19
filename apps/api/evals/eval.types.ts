import type {
  AgentFinding,
  AgentType,
  FindingSeverity,
} from '../src/analysis-runs/agents/analysis-agent.types.js';
import type {
  MergeDecision,
  MergeDecisionReasonCode,
} from '../src/analysis-runs/merge-decision/merge-decision.types.js';
import type { ToolName } from '../src/analysis-runs/tools/tool.types.js';

export type EvalCategory =
  'agent-quality' | 'tool-behavior' | 'decision' | 'workflow';

export type EvalAgentExpectation = {
  findingCount?: number;
  minimumFindings?: number;
  maximumFindings?: number;
  minimumSeverity?: FindingSeverity;
  maximumSeverity?: FindingSeverity;
  requiredTools?: ToolName[];
};

export type EvalCase = {
  id: string;
  description: string;
  repositoryContext: {
    title: string;
    description: string;
    changedFiles: string[];
  };
  agents: Record<
    AgentType,
    { findings: AgentFinding[]; tools: readonly ToolName[] }
  >;
  expected: {
    agents?: Partial<Record<AgentType, EvalAgentExpectation>>;
    mergeDecision: MergeDecision;
    reasonCodes?: MergeDecisionReasonCode[];
    afterRejectingAgent?: {
      agentType: AgentType;
      decision: MergeDecision;
    };
  };
};

export type EvalAssertionResult = {
  name: string;
  category: EvalCategory;
  passed: boolean;
  expected: unknown;
  actual: unknown;
};

export type EvalCaseResult = {
  caseId: string;
  passed: boolean;
  assertions: EvalAssertionResult[];
};

export type EvalSuiteResult = {
  suiteVersion: 'day6-v1';
  providerMode: 'fake';
  model: 'fixture-model-v1';
  promptVersions: Record<AgentType, string>;
  timestamp: string;
  passed: boolean;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  cases: EvalCaseResult[];
};
