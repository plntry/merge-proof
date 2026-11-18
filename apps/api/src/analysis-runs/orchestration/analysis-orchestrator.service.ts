import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ANALYSIS_AGENTS,
  type AnalysisAgent,
} from '../agents/analysis-agent.interface.js';
import type { AgentRun } from '../agents/agent-run.types.js';
import {
  AGENT_RUN_REPOSITORY,
  type AgentRunRepository,
} from '../agents/repositories/agent-run.repository.interface.js';
import { FindingProjectionService } from '../findings/finding-projection.service.js';
import {
  ANALYSIS_CONTEXT_REPOSITORY,
  type AnalysisContextRepository,
  type AnalysisReviewContext,
} from '../repositories/analysis-context-repository.interface.js';
import type {
  AgentExecutionSummary,
  AnalysisOrchestrationResult,
} from './orchestration.types.js';

@Injectable()
export class AnalysisOrchestrator {
  private readonly logger = new Logger(AnalysisOrchestrator.name);

  constructor(
    @Inject(ANALYSIS_AGENTS)
    private readonly agents: readonly AnalysisAgent[],
    @Inject(ANALYSIS_CONTEXT_REPOSITORY)
    private readonly analysisContextRepository: AnalysisContextRepository,
    @Inject(AGENT_RUN_REPOSITORY)
    private readonly agentRunRepository: AgentRunRepository,
    private readonly findingProjectionService: FindingProjectionService,
    private readonly configService: ConfigService,
  ) {}

  async run(analysisRunId: string): Promise<AnalysisOrchestrationResult> {
    const context =
      await this.analysisContextRepository.findByAnalysisRunId(analysisRunId);

    if (!context) {
      throw new Error(`Review context for analysis run ${analysisRunId} not found`);
    }

    const model = this.configService.getOrThrow<string>('OPENAI_MODEL');
    const summaries = await Promise.all(
      this.agents.map((agent) => this.executeAgent(agent, context, model)),
    );

    return {
      agents: summaries,
      completedAgents: summaries
        .filter((summary) => summary.status === 'completed')
        .map((summary) => summary.agentType),
      failedAgents: summaries
        .filter((summary) => summary.status === 'failed')
        .map((summary) => summary.agentType),
    };
  }

  private async executeAgent(
    agent: AnalysisAgent,
    context: AnalysisReviewContext,
    model: string,
  ): Promise<AgentExecutionSummary> {
    let agentRun: AgentRun | undefined;
    let claimed = false;

    try {
      agentRun = await this.agentRunRepository.findOrCreate({
        id: randomUUID(),
        analysisRunId: context.analysisRunId,
        agentType: agent.type,
        status: 'pending',
        model,
      });

      if (agentRun.status === 'completed') {
        return await this.reuseCompletedRun(agentRun, context.analysisRunId);
      }

      const runningAgentRun = await this.agentRunRepository.markRunning(
        agentRun.id,
      );

      if (!runningAgentRun) {
        const current =
          await this.agentRunRepository.findByAnalysisRunAndType(
            context.analysisRunId,
            agent.type,
          );

        if (current?.status === 'completed') {
          return await this.reuseCompletedRun(current, context.analysisRunId);
        }

        throw new Error(`Agent run ${agentRun.id} is already being executed`);
      }

      agentRun = runningAgentRun;
      claimed = true;
      this.logStatus(context.analysisRunId, agentRun, 'running');

      const output = await agent.run({
        analysisRunId: context.analysisRunId,
        agentRunId: agentRun.id,
        repository: context.repository,
        pullRequestNumber: context.pullRequestNumber,
      });
      const completedAgentRun = await this.agentRunRepository.markCompleted(
        agentRun.id,
        output,
      );

      if (!completedAgentRun) {
        throw new Error(`Agent run ${agentRun.id} could not be completed`);
      }

      agentRun = completedAgentRun;
      const findingCount =
        await this.findingProjectionService.projectAgentOutput(
          context.analysisRunId,
          agentRun.id,
          output,
        );

      this.logStatus(context.analysisRunId, agentRun, 'completed');
      return { agentType: agent.type, status: 'completed', findingCount };
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      if (claimed && agentRun && agentRun.status !== 'completed') {
        try {
          await this.agentRunRepository.markFailed(
            agentRun.id,
            normalizedError.message,
          );
        } catch (persistenceError) {
          this.logger.error({
            analysisRunId: context.analysisRunId,
            agentRunId: agentRun.id,
            agentType: agent.type,
            status: 'failed_to_persist_failure',
            error:
              persistenceError instanceof Error
                ? persistenceError.message
                : String(persistenceError),
          });
        }
      }

      this.logger.warn({
        analysisRunId: context.analysisRunId,
        agentRunId: agentRun?.id,
        agentType: agent.type,
        status: 'failed',
        error: normalizedError.message,
      });

      return {
        agentType: agent.type,
        status: 'failed',
        findingCount: 0,
        errorMessage: normalizedError.message,
      };
    }
  }

  private async reuseCompletedRun(
    agentRun: AgentRun,
    analysisRunId: string,
  ): Promise<AgentExecutionSummary> {
    if (agentRun.output == null) {
      throw new Error(`Completed agent run ${agentRun.id} has no output`);
    }

    const findingCount = await this.findingProjectionService.projectAgentOutput(
      analysisRunId,
      agentRun.id,
      agentRun.output,
    );

    this.logStatus(analysisRunId, agentRun, 'reused');
    return {
      agentType: agentRun.agentType,
      status: 'completed',
      findingCount,
    };
  }

  private logStatus(
    analysisRunId: string,
    agentRun: AgentRun,
    status: 'running' | 'completed' | 'reused',
  ): void {
    this.logger.log({
      analysisRunId,
      agentRunId: agentRun.id,
      agentType: agentRun.agentType,
      status,
    });
  }
}
