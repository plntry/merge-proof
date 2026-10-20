import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';
import { REVIEW_REPOSITORY } from './repositories/review-repository.interface.js';
// import { InMemoryReviewRepository } from './repositories/in-memory-review.repository.js';
import { DatabaseModule } from '../database/database.module.js';
import { PostgresReviewRepository } from './repositories/postgres-review.repository.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    {
      provide: REVIEW_REPOSITORY,
      useClass: PostgresReviewRepository,
    },
  ],
})
export class ReviewsModule {}
