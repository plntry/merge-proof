import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';

import { UpdateFindingReviewDto } from './dto/update-finding-review.dto.js';
import { FindingReviewService } from './finding-review.service.js';

@Controller('findings')
export class FindingReviewController {
  constructor(private readonly findingReviewService: FindingReviewService) {}

  @Patch(':findingId/review')
  review(
    @Param('findingId') findingId: string,
    @Body() dto: UpdateFindingReviewDto,
  ) {
    return this.findingReviewService.reviewFinding(findingId, dto);
  }

  @Delete(':findingId/review')
  @HttpCode(HttpStatus.NO_CONTENT)
  reset(@Param('findingId') findingId: string) {
    return this.findingReviewService.resetReview(findingId);
  }
}
