import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';

import { DATABASE_POOL } from '../../../database/database.constants.js';
import { MergeAssessmentService } from '../../merge-assessment/merge-assessment.service.js';
import {
  ANALYSIS_RUN_REPOSITORY,
  type AnalysisRunRepository,
} from '../../repositories/analysis-run-repository.interface.js';
import {
  FINDING_REPOSITORY,
  type FindingRepository,
} from '../repositories/finding-repository.interface.js';
import type { UpdateFindingReviewDto } from './dto/update-finding-review.dto.js';
import type { FindingReview } from './finding-review.types.js';
import {
  FINDING_REVIEW_REPOSITORY,
  type FindingReviewRepository,
} from './repositories/finding-review-repository.interface.js';

@Injectable()
export class FindingReviewService {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
    @Inject(FINDING_REPOSITORY)
    private readonly findingRepository: FindingRepository,
    @Inject(FINDING_REVIEW_REPOSITORY)
    private readonly findingReviewRepository: FindingReviewRepository,
    @Inject(ANALYSIS_RUN_REPOSITORY)
    private readonly analysisRunRepository: AnalysisRunRepository,
    private readonly mergeAssessmentService: MergeAssessmentService,
  ) {}

  async reviewFinding(
    findingId: string,
    dto: UpdateFindingReviewDto,
  ): Promise<FindingReview> {
    this.validateReviewSemantics(dto);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const finding = await this.findingRepository.findById(findingId, client);

      if (!finding) {
        throw new NotFoundException(`Finding ${findingId} not found`);
      }

      await this.analysisRunRepository.lockById(finding.analysisRunId, client);
      const edited = dto.status === 'edited' ? dto.editedFinding! : undefined;
      const review = await this.findingReviewRepository.upsert(
        {
          id: randomUUID(),
          findingId,
          status: dto.status,
          editedTitle: edited?.title.trim() ?? null,
          editedDescription: edited?.description.trim() ?? null,
          editedSeverity: edited?.severity ?? null,
          reviewNote: dto.note?.trim() || null,
          reviewedBy: null,
        },
        client,
      );
      await this.mergeAssessmentService.recalculate(
        finding.analysisRunId,
        client,
      );
      await client.query('COMMIT');
      return review;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async resetReview(findingId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const finding = await this.findingRepository.findById(findingId, client);

      if (!finding) {
        throw new NotFoundException(`Finding ${findingId} not found`);
      }

      await this.analysisRunRepository.lockById(finding.analysisRunId, client);
      await this.findingReviewRepository.deleteByFindingId(findingId, client);
      await this.mergeAssessmentService.recalculate(
        finding.analysisRunId,
        client,
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private validateReviewSemantics(dto: UpdateFindingReviewDto): void {
    if (dto.status === 'edited' && !dto.editedFinding) {
      throw new BadRequestException(
        'editedFinding is required when status is edited',
      );
    }

    if (dto.status !== 'edited' && dto.editedFinding) {
      throw new BadRequestException(
        'editedFinding is only allowed when status is edited',
      );
    }
  }
}
