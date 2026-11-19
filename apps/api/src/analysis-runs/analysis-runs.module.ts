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
import { SecurityAgent } from './agents/security-agent.service.js';
import { ArchitectureAgent } from './agents/architecture-agent.service.js';
import { TestAgent } from './agents/test-agent.service.js';
import { ToolCallingAgentRunner } from './agents/tool-calling-agent-runner.service.js';
import { ANALYSIS_AGENTS } from './agents/analysis-agent.interface.js';
import { AnalysisOrchestrator } from './orchestration/analysis-orchestrator.service.js';
import { FINDING_REVIEW_REPOSITORY } from './findings/reviews/repositories/finding-review-repository.interface.js';
import { PostgresFindingReviewRepository } from './findings/reviews/repositories/postgres-finding-review.repository.js';
import { FindingReviewService } from './findings/reviews/finding-review.service.js';
import { FindingReviewController } from './findings/reviews/finding-review.controller.js';
import { EffectiveFindingService } from './findings/effective/effective-finding.service.js';
import { MERGE_ASSESSMENT_REPOSITORY } from './merge-assessment/repositories/merge-assessment-repository.interface.js';
import { PostgresMergeAssessmentRepository } from './merge-assessment/repositories/postgres-merge-assessment.repository.js';
import { MergeAssessmentService } from './merge-assessment/merge-assessment.service.js';
import { MergeDecisionEngine } from './merge-decision/merge-decision-engine.js';
import { AnalysisResultsService } from './analysis-results.service.js';
import { AnalysisResultsController } from './analysis-results.controller.js';
import { TRACE_EVENT_REPOSITORY } from './tracing/repositories/trace-event-repository.interface.js';
import { PostgresTraceEventRepository } from './tracing/repositories/postgres-trace-event.repository.js';
import { TraceRecorder } from './tracing/trace-recorder.service.js';
import { AnalysisTraceService } from './tracing/analysis-trace.service.js';
import { AnalysisTraceController } from './tracing/analysis-trace.controller.js';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: ANALYSIS_QUEUE }),
    AiModule,
  ],
  controllers: [
    FindingReviewController,
    AnalysisResultsController,
    AnalysisTraceController,
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
    {
      provide: FINDING_REVIEW_REPOSITORY,
      useClass: PostgresFindingReviewRepository,
    },
    {
      provide: MERGE_ASSESSMENT_REPOSITORY,
      useClass: PostgresMergeAssessmentRepository,
    },
    {
      provide: TRACE_EVENT_REPOSITORY,
      useClass: PostgresTraceEventRepository,
    },
    AnalysisQueueService,
    AnalysisProcessor,
    RequirementsAgent,
    SecurityAgent,
    ArchitectureAgent,
    TestAgent,
    {
      provide: ANALYSIS_AGENTS,
      inject: [RequirementsAgent, SecurityAgent, ArchitectureAgent, TestAgent],
      useFactory: (
        requirementsAgent: RequirementsAgent,
        securityAgent: SecurityAgent,
        architectureAgent: ArchitectureAgent,
        testAgent: TestAgent,
      ) => [requirementsAgent, securityAgent, architectureAgent, testAgent],
    },
    ToolCallingAgentRunner,
    AnalysisOrchestrator,
    ToolRegistry,
    FindingProjectionService,
    FindingReviewService,
    EffectiveFindingService,
    MergeDecisionEngine,
    MergeAssessmentService,
    AnalysisResultsService,
    TraceRecorder,
    AnalysisTraceService,
  ],
  exports: [ANALYSIS_RUN_REPOSITORY, AnalysisQueueService],
})
export class AnalysisRunsModule {}
