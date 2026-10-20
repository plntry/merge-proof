import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateReviewDto } from './dto/create-review.dto.js';
import type { Review } from './types/review.type.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from './repositories/review-repository.interface.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants.js';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,

    private readonly organizationsRepository: OrganizationsRepository,

    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  async create(dto: CreateReviewDto): Promise<Review> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const remainingCredits = await this.organizationsRepository.consumeCredit(
        dto.organizationId,
        client,
      );

      if (remainingCredits === undefined) {
        throw new BadRequestException('Organization has no available credits');
      }

      const review: Review = {
        ...dto,
        id: randomUUID(),
        status: 'pending',
      };

      const savedReview = await this.reviewRepository.save(review, client);

      await client.query('COMMIT');

      return savedReview;
    } catch (error) {
      await client.query('ROLLBACK');

      throw error;
    } finally {
      client.release();
    }
  }

  findAll(): Promise<Review[]> {
    return this.reviewRepository.findAll();
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.reviewRepository.findById(id);

    if (!review) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }

    return review;
  }

  async update(id: string, dto: UpdateReviewDto): Promise<Review> {
    const review = await this.findOne(id);

    if (dto.status !== undefined) {
      review.status = dto.status;
    }

    const updatedReview = await this.reviewRepository.update(review);

    if (!updatedReview) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }

    return updatedReview;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.reviewRepository.remove(id);

    if (!removed) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }
  }
}
