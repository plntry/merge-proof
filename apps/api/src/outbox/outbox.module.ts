import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OUTBOX_REPOSITORY } from './repositories/outbox.repository.interface.js';
import { PostgresOutboxRepository } from './repositories/postgres-outbox.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: OUTBOX_REPOSITORY,
      useClass: PostgresOutboxRepository,
    },
  ],
  exports: [OUTBOX_REPOSITORY],
})
export class OutboxModule {}
