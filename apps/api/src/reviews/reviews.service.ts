import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateReviewDto } from './dto/create-review.dto.js';
import type { Review } from './types/review.type.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from './repositories/review-repository.interface.js';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
  ) {}

  create(dto: CreateReviewDto): Promise<Review> {
    const review: Review = {
      ...dto,
      id: randomUUID(),
      status: 'pending',
    };

    return this.reviewRepository.save(review);
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
