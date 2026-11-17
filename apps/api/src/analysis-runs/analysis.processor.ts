import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  ANALYSIS_QUEUE,
  ANALYZE_REVIEW_JOB,
} from './analysis-runs.constants.js';
import type { AnalysisJobData } from './analysis-queue.service.js';
import {
  ANALYSIS_RUN_REPOSITORY,
  type AnalysisRunRepository,
} from './repositories/analysis-run-repository.interface.js';
import { RequirementsAgent } from './agents/requirements-agent.service.js';
import {
  AGENT_RUN_REPOSITORY,
  type AgentRunRepository,
} from './agents/repositories/agent-run.repository.interface.js';
import { ConfigService } from '@nestjs/config';
import { AgentRun } from './agents/agent-run.types.js';

@Processor(ANALYSIS_QUEUE)
export class AnalysisProcessor extends WorkerHost {
  constructor(
    @Inject(ANALYSIS_RUN_REPOSITORY)
    private readonly analysisRunRepository: AnalysisRunRepository,

    @Inject(AGENT_RUN_REPOSITORY)
    private readonly agentRunRepository: AgentRunRepository,

    private readonly requirementsAgent: RequirementsAgent,

    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<AnalysisJobData>): Promise<void> {
    if (job.name !== ANALYZE_REVIEW_JOB) {
      throw new Error(`Unsupported job: ${job.name}`);
    }

    const analysisRun = await this.analysisRunRepository.findById(
      job.data.analysisRunId,
    );

    if (!analysisRun) {
      throw new Error(`Analysis run ${job.data.analysisRunId} not found`);
    }

    const startedRun = await this.analysisRunRepository.markRunning(
      analysisRun.id,
      job.attemptsMade,
    );

    if (!startedRun) {
      return;
    }

    let agentRun: AgentRun | undefined;

    try {
      agentRun = await this.agentRunRepository.findByAnalysisRunAndType(
        startedRun.id,
        'requirements',
      );

      if (!agentRun) {
        const model = this.configService.getOrThrow<string>('OPENAI_MODEL');

        agentRun = await this.agentRunRepository.save({
          id: randomUUID(),
          analysisRunId: startedRun.id,
          agentType: 'requirements',
          status: 'pending',
          model,
        });
      }

      if (agentRun.status === 'completed') {
        await this.analysisRunRepository.markCompleted(startedRun.id);

        return;
      }

      const runningAgentRun = await this.agentRunRepository.markRunning(
        agentRun.id,
      );

      if (!runningAgentRun) {
        throw new Error(`Agent run ${agentRun.id} could not be started`);
      }

      const result = await this.requirementsAgent.analyze(`
Feature request:
Users should only be able to create a review when their organization has available credits.

Implementation:
The API creates a review without checking organization credits.
    `);

      await this.agentRunRepository.markCompleted(runningAgentRun.id, result);

      await this.analysisRunRepository.markCompleted(startedRun.id);
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      const maxAttempts = job.opts.attempts ?? 1;

      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        if (agentRun) {
          await this.agentRunRepository.markFailed(
            agentRun.id,
            normalizedError.message,
          );
        }

        await this.analysisRunRepository.markFailed(
          startedRun.id,
          normalizedError.message,
        );
      }

      throw normalizedError;
    }
  }
}
