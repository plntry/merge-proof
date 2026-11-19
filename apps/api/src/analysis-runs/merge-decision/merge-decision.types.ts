import type { AgentType } from '../agents/analysis-agent.types.js';
import type { EffectiveFinding } from '../findings/effective/effective-finding.types.js';

export const MERGE_DECISIONS = ['ready', 'needs_review', 'blocked'] as const;

export type MergeDecision = (typeof MERGE_DECISIONS)[number];

export const MERGE_DECISION_REASON_CODES = [
  'HUMAN_CONFIRMED_CRITICAL_FINDING',
  'HIGH_CONFIDENCE_CRITICAL_FINDING',
  'RISK_SCORE_BLOCK_THRESHOLD',
  'INCOMPLETE_AGENT_COVERAGE',
  'UNREVIEWED_CRITICAL_FINDING',
  'HIGH_CONFIDENCE_HIGH_FINDING',
  'RISK_SCORE_REVIEW_THRESHOLD',
] as const;

export type MergeDecisionReasonCode =
  (typeof MERGE_DECISION_REASON_CODES)[number];

export type MergeDecisionReason = {
  code: MergeDecisionReasonCode;
  message: string;
  findingId?: string;
  agentType?: AgentType;
};

export type AgentCoverage = {
  agentType: AgentType;
  status: 'completed' | 'failed';
};

export type MergeDecisionInput = {
  findings: EffectiveFinding[];
  agentCoverage: AgentCoverage[];
};

export type MergeAssessmentSummary = {
  totalFindings: number;
  activeFindings: number;
  rejectedFindings: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  reviewedFindings: number;
  unreviewedFindings: number;
  completedAgents: number;
  failedAgents: number;
};

export type MergeDecisionResult = {
  decision: MergeDecision;
  riskScore: number;
  reasons: MergeDecisionReason[];
  summary: MergeAssessmentSummary;
};
