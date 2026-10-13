import { IsInt, IsNotEmpty, IsPositive, IsString } from "class-validator";

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  repository!: string;

  @IsInt()
  @IsPositive()
  pullRequestNumber!: number;
}