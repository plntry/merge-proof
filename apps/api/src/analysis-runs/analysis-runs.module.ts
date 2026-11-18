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
import { FINDING_REPOSITORY } from './findings/repositories/finding-repository.interface.js';
import { PostgresFindingRepository } from './findings/repositories/postgres-finding.repository.js';
import { FindingProjectionService } from './findings/finding-projection.service.js';
import { ANALYSIS_CONTEXT_REPOSITORY } from './repositories/analysis-context-repository.interface.js';
import { PostgresAnalysisContextRepository } from './repositories/postgres-analysis-context.repository.js';
import { REPOSITORY_SOURCE } from './tools/repository-source.interface.js';
import { MockRepositorySource } from './tools/mock-repository-source.service.js';
import { TOOL_CALL_REPOSITORY } from './tools/audit/tool-call-repository.interface.js';
import { PostgresToolCallRepository } from './tools/audit/postgres-tool-call.repository.js';
import { ToolRegistry } from './tools/tool-registry.service.js';

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
    {
      provide: ANALYSIS_CONTEXT_REPOSITORY,
      useClass: PostgresAnalysisContextRepository,
    },
    {
      provide: REPOSITORY_SOURCE,
      useClass: MockRepositorySource,
    },
    {
      provide: TOOL_CALL_REPOSITORY,
      useClass: PostgresToolCallRepository,
    },
    {
      provide: FINDING_REPOSITORY,
      useClass: PostgresFindingRepository,
    },
    AnalysisQueueService,
    AnalysisProcessor,
    RequirementsAgent,
    ToolRegistry,
    FindingProjectionService,
  ],
  exports: [ANALYSIS_RUN_REPOSITORY, AnalysisQueueService],
})
export class AnalysisRunsModule {}
