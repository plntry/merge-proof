import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OUTBOX_REPOSITORY } from './repositories/outbox.repository.interface.js';
import { PostgresOutboxRepository } from './repositories/postgres-outbox.repository.js';
import { AnalysisRunsModule } from '../analysis-runs/analysis-runs.module.js';
import { OutboxPublisherService } from './outbox-publisher.service.js';

@Module({
  imports: [DatabaseModule, AnalysisRunsModule],
  providers: [
    {
      provide: OUTBOX_REPOSITORY,
      useClass: PostgresOutboxRepository,
    },
    OutboxPublisherService,
  ],
  exports: [OUTBOX_REPOSITORY],
})
export class OutboxModule {}
