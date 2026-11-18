import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service.js';
import { REVIEW_REPOSITORY } from './repositories/review-repository.interface.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { DATABASE_POOL } from '../database/database.constants.js';
import { ANALYSIS_RUN_REPOSITORY } from '../analysis-runs/repositories/analysis-run-repository.interface.js';
import { OUTBOX_REPOSITORY } from '../outbox/repositories/outbox.repository.interface.js';

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: REVIEW_REPOSITORY, useValue: {} },
        { provide: OrganizationsRepository, useValue: {} },
        { provide: DATABASE_POOL, useValue: {} },
        { provide: ANALYSIS_RUN_REPOSITORY, useValue: {} },
        { provide: OUTBOX_REPOSITORY, useValue: {} },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
