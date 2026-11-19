import type {
  AgentType,
  FindingSeverity,
} from '../../agents/analysis-agent.types.js';
import type {
  FindingReview,
  FindingReviewStatus,
} from '../reviews/finding-review.types.js';
import type { FindingWithAgentType } from '../finding.types.js';

export type FindingReviewState = 'unreviewed' | FindingReviewStatus;

export type EffectiveFinding = {
  findingId: string;
  agentType: AgentType;
  title: string;
  description: string;
  severity: FindingSeverity;
  originalConfidence: number;
  reviewStatus: FindingReviewState;
  humanVerified: boolean;
  excluded: boolean;
};

export type FindingPresentation = {
  id: string;
  agentType: AgentType;
  original: {
    title: string;
    description: string;
    severity: FindingSeverity;
    confidence: number;
  };
  review: null | {
    status: FindingReviewStatus;
    note: string | null;
    reviewedBy: string | null;
    editedFinding: null | {
      title: string;
      description: string;
      severity: FindingSeverity;
    };
    createdAt: Date;
    updatedAt: Date;
  };
  effective: {
    title: string;
    description: string;
    severity: FindingSeverity;
    humanVerified: boolean;
    excluded: boolean;
  };
};

export type FindingWithReview = {
  finding: FindingWithAgentType;
  review?: FindingReview;
};
