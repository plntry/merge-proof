import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ANALYSIS_RUN_REPOSITORY } from './repositories/analysis-run-repository.interface.js';
import { PostgresAnalysisRunRepository } from './repositories/postgres-analysis-run.repository.js';
import { BullModule } from '@nestjs/bullmq';
import { ANALYSIS_QUEUE } from './analysis-runs.constants.js';
import { AnalysisQueueService } from './analysis-queue.service.js';

@Module({
  imports: [DatabaseModule, BullModule.registerQueue({ name: ANALYSIS_QUEUE })],
  providers: [
    {
      provide: ANALYSIS_RUN_REPOSITORY,
      useClass: PostgresAnalysisRunRepository,
    },
    AnalysisQueueService,
  ],
  exports: [ANALYSIS_RUN_REPOSITORY, AnalysisQueueService],
})
export class AnalysisRunsModule {}
