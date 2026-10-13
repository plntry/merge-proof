export const REVIEW_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type Review = {
  id: string;
  repository: string;
  pullRequestNumber: number;
  status: ReviewStatus;
};
