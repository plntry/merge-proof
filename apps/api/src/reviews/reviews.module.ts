import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';
import { REVIEW_REPOSITORY } from './repositories/review-repository.interface.js';
import { InMemoryReviewRepository } from './repositories/in-memory-review.repository.js';

@Module({
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    { provide: REVIEW_REPOSITORY, useClass: InMemoryReviewRepository },
  ],
})
export class ReviewsModule {}
