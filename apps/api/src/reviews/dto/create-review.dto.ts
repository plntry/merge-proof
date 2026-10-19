import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  repository!: string;

  @IsInt()
  @IsPositive()
  pullRequestNumber!: number;
}
