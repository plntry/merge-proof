import { IsIn, IsOptional } from 'class-validator';
import { REVIEW_STATUSES, type ReviewStatus } from '../types/review.type.js';

export class UpdateReviewDto {
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: ReviewStatus;
}
