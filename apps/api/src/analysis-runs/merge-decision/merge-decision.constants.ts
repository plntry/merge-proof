import type { FindingSeverity } from '../agents/analysis-agent.types.js';

export const SEVERITY_WEIGHTS = {
  low: 5,
  medium: 15,
  high: 30,
  critical: 50,
} as const satisfies Record<FindingSeverity, number>;

export const BLOCK_SCORE_THRESHOLD = 70;
export const REVIEW_SCORE_THRESHOLD = 30;
export const CRITICAL_AUTO_BLOCK_CONFIDENCE = 0.9;
export const HIGH_REVIEW_CONFIDENCE = 0.6;
