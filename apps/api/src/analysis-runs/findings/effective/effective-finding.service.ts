import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import {
  FINDING_REPOSITORY,
  type FindingRepository,
} from '../repositories/finding-repository.interface.js';
import {
  FINDING_REVIEW_REPOSITORY,
  type FindingReviewRepository,
} from '../reviews/repositories/finding-review-repository.interface.js';
import type { FindingReview } from '../reviews/finding-review.types.js';
import type { FindingWithAgentType } from '../finding.types.js';
import type {
  EffectiveFinding,
  FindingPresentation,
  FindingWithReview,
} from './effective-finding.types.js';

@Injectable()
export class EffectiveFindingService {
  constructor(
    @Inject(FINDING_REPOSITORY)
    private readonly findingRepository: FindingRepository,
    @Inject(FINDING_REVIEW_REPOSITORY)
    private readonly findingReviewRepository: FindingReviewRepository,
  ) {}

  async findByAnalysisRunId(
    analysisRunId: string,
    client?: PoolClient,
  ): Promise<FindingWithReview[]> {
    const findings =
      await this.findingRepository.findByAnalysisRunIdWithAgentType(
        analysisRunId,
        client,
      );
    const reviews = await this.findingReviewRepository.findByFindingIds(
      findings.map((finding) => finding.id),
      client,
    );
    const reviewsByFindingId = new Map(
      reviews.map((review) => [review.findingId, review]),
    );

    return findings.map((finding) => ({
      finding,
      review: reviewsByFindingId.get(finding.id),
    }));
  }

  resolve(
    finding: FindingWithAgentType,
    review?: FindingReview,
  ): EffectiveFinding {
    if (!review) {
      return {
        findingId: finding.id,
        agentType: finding.agentType,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        originalConfidence: finding.confidence,
        reviewStatus: 'unreviewed',
        humanVerified: false,
        excluded: false,
      };
    }

    if (review.status === 'rejected') {
      return {
        findingId: finding.id,
        agentType: finding.agentType,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        originalConfidence: finding.confidence,
        reviewStatus: review.status,
        humanVerified: false,
        excluded: true,
      };
    }

    if (review.status === 'edited') {
      if (
        review.editedTitle == null ||
        review.editedDescription == null ||
        review.editedSeverity == null
      ) {
        throw new Error(`Edited review ${review.id} is incomplete`);
      }

      return {
        findingId: finding.id,
        agentType: finding.agentType,
        title: review.editedTitle,
        description: review.editedDescription,
        severity: review.editedSeverity,
        originalConfidence: finding.confidence,
        reviewStatus: review.status,
        humanVerified: true,
        excluded: false,
      };
    }

    return {
      findingId: finding.id,
      agentType: finding.agentType,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      originalConfidence: finding.confidence,
      reviewStatus: review.status,
      humanVerified: true,
      excluded: false,
    };
  }

  present(
    finding: FindingWithAgentType,
    review?: FindingReview,
  ): FindingPresentation {
    const effective = this.resolve(finding, review);
    return {
      id: finding.id,
      agentType: finding.agentType,
      original: {
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        confidence: finding.confidence,
      },
      review: review
        ? {
            status: review.status,
            note: review.reviewNote,
            reviewedBy: review.reviewedBy,
            editedFinding:
              review.status === 'edited'
                ? {
                    title: review.editedTitle!,
                    description: review.editedDescription!,
                    severity: review.editedSeverity!,
                  }
                : null,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
          }
        : null,
      effective: {
        title: effective.title,
        description: effective.description,
        severity: effective.severity,
        humanVerified: effective.humanVerified,
        excluded: effective.excluded,
      },
    };
  }
}
