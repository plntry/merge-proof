import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ANALYSIS_RUN_REPOSITORY } from './repositories/analysis-run-repository.interface.js';
import { PostgresAnalysisRunRepository } from './repositories/postgres-analysis-run.repository.js';
import { BullModule } from '@nestjs/bullmq';
import { ANALYSIS_QUEUE } from './analysis-runs.constants.js';
import { AnalysisQueueService } from './analysis-queue.service.js';
import { AnalysisProcessor } from './analysis.processor.js';
import { AiModule } from '../ai/ai.module.js';
import { RequirementsAgent } from './agents/requirements-agent.service.js';
import { AGENT_RUN_REPOSITORY } from './agents/repositories/agent-run.repository.interface.js';
import { PostgresAgentRunRepository } from './agents/repositories/postgres-agent-run.repository.js';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: ANALYSIS_QUEUE }),
    AiModule,
  ],
  providers: [
    {
      provide: ANALYSIS_RUN_REPOSITORY,
      useClass: PostgresAnalysisRunRepository,
    },
    {
      provide: AGENT_RUN_REPOSITORY,
      useClass: PostgresAgentRunRepository,
    },
    AnalysisQueueService,
    AnalysisProcessor,
    RequirementsAgent,
  ],
  exports: [ANALYSIS_RUN_REPOSITORY, AnalysisQueueService],
})
export class AnalysisRunsModule {}
