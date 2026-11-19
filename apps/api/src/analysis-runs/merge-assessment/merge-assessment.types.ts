import type {
  MergeAssessmentSummary,
  MergeDecision,
  MergeDecisionReason,
} from '../merge-decision/merge-decision.types.js';

export type NewMergeAssessment = {
  id: string;
  analysisRunId: string;
  decision: MergeDecision;
  riskScore: number;
  reasons: MergeDecisionReason[];
  summary: MergeAssessmentSummary;
};

export type MergeAssessment = NewMergeAssessment & {
  createdAt: Date;
  updatedAt: Date;
};
