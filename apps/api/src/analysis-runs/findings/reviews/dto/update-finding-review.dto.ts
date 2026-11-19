import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { FINDING_SEVERITIES } from '../../../agents/analysis-agent.types.js';
import {
  FINDING_REVIEW_STATUSES,
  type FindingReviewStatus,
} from '../finding-review.types.js';
import type { FindingSeverity } from '../../../agents/analysis-agent.types.js';

export class EditedFindingDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'title must contain non-whitespace characters' })
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, {
    message: 'description must contain non-whitespace characters',
  })
  @MaxLength(5000)
  description!: string;

  @IsIn(FINDING_SEVERITIES)
  severity!: FindingSeverity;
}

export class UpdateFindingReviewDto {
  @IsIn(FINDING_REVIEW_STATUSES)
  status!: FindingReviewStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => EditedFindingDto)
  editedFinding?: EditedFindingDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
