import { Injectable } from '@nestjs/common';
import type { Review } from '../types/review.type.js';
import type { ReviewRepository } from './review-repository.interface.js';

@Injectable()
export class InMemoryReviewRepository implements ReviewRepository {
  private readonly reviews: Review[] = [];

  async findAll(): Promise<Review[]> {
    return this.reviews;
  }

  async findById(id: string): Promise<Review | undefined> {
    return this.reviews.find((review) => review.id === id);
  }

  async save(review: Review): Promise<Review> {
    this.reviews.push(review);

    return review;
  }

  async update(review: Review): Promise<Review | undefined> {
    const reviewIndex = this.reviews.findIndex((item) => item.id === review.id);

    if (reviewIndex === -1) {
      return undefined;
    }
    this.reviews[reviewIndex] = review;

    return review;
  }

  async remove(id: string): Promise<boolean> {
    const reviewIndex = this.reviews.findIndex((item) => item.id === id);

    if (reviewIndex === -1) {
      return false;
    }

    this.reviews.splice(reviewIndex, 1);

    return true;
  }
}
