import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { Review } from './types/review.type.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';

@Injectable()
export class ReviewsService {
  private readonly reviews: Review[] = [];

  create(dto: CreateReviewDto): Review {
    const review: Review = {
      ...dto,
      id: String(this.reviews.length + 1),
      status: 'pending',
    };
    this.reviews.push(review);

    return review;
  }

  findAll(): Review[] {
    return this.reviews;
  }

  findOne(id: string): Review {
    const review = this.reviews.find((review) => review.id === id);

    if (!review) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }

    return review;
  }

  update(id: string, dto: UpdateReviewDto): Review {
    const review = this.findOne(id);

    if (dto.status !== undefined) {
      review.status = dto.status;
    }

    return review;
  }

  remove(id: string) {
    const review = this.findOne(id);
    const reviewIndex = this.reviews.indexOf(review);

    this.reviews.splice(reviewIndex, 1);
  }
}
