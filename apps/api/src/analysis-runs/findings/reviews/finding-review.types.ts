import type { FindingSeverity } from '../../agents/analysis-agent.types.js';

export const FINDING_REVIEW_STATUSES = [
  'accepted',
  'rejected',
  'edited',
] as const;

export type FindingReviewStatus = (typeof FINDING_REVIEW_STATUSES)[number];

export type NewFindingReview = {
  id: string;
  findingId: string;
  status: FindingReviewStatus;
  editedTitle: string | null;
  editedDescription: string | null;
  editedSeverity: FindingSeverity | null;
  reviewNote: string | null;
  reviewedBy: string | null;
};

export type FindingReview = NewFindingReview & {
  createdAt: Date;
  updatedAt: Date;
};
