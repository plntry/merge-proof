import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from './repositories/outbox.repository.interface.js';
import { AnalysisQueueService } from '../analysis-runs/analysis-queue.service.js';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,

    private readonly analysisQueueService: AnalysisQueueService,
  ) {}

  @Cron('*/5 * * * * *', { waitForCompletion: true })
  async publishPending(limit = 10): Promise<void> {
    const events = await this.outboxRepository.findPending(limit);

    for (const event of events) {
      if (event.eventType !== 'analysis.requested') {
        continue;
      }

      await this.analysisQueueService.enqueueAnalysis(
        event.payload.analysisRunId,
      );

      await this.outboxRepository.markPublished(event.id);

      this.logger.log(`Published outbox event ${event.id}`);
    }
  }
}
