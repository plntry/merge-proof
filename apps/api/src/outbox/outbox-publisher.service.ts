import { Inject, Injectable } from '@nestjs/common';
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from './repositories/outbox.repository.interface.js';
import { AnalysisQueueService } from '../analysis-runs/analysis-queue.service.js';

@Injectable()
export class OutboxPublisherService {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,

    private readonly analysisQueueService: AnalysisQueueService,
  ) {}

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
    }
  }
}
