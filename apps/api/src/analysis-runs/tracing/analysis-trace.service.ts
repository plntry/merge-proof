import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  AGENT_RUN_REPOSITORY,
  type AgentRunRepository,
} from '../agents/repositories/agent-run.repository.interface.js';
import type { FindingSeverity } from '../agents/analysis-agent.types.js';
import {
  FINDING_REPOSITORY,
  type FindingRepository,
} from '../findings/repositories/finding-repository.interface.js';
import {
  ANALYSIS_RUN_REPOSITORY,
  type AnalysisRunRepository,
} from '../repositories/analysis-run-repository.interface.js';
import {
  TOOL_CALL_REPOSITORY,
  type ToolCallRepository,
} from '../tools/audit/tool-call-repository.interface.js';
import type {
  AgentTraceSummary,
  AnalysisTrace,
  TokenUsageSummary,
  TraceSeverityCounts,
} from './analysis-trace.types.js';
import {
  TRACE_EVENT_REPOSITORY,
  type TraceEventRepository,
} from './repositories/trace-event-repository.interface.js';
import type { TraceEvent } from './trace-event.types.js';

const EMPTY_SEVERITIES: TraceSeverityCounts = {
  low: 0,
  medium: 0,
  high: 0,
  critical: 0,
};

@Injectable()
export class AnalysisTraceService {
  constructor(
    @Inject(ANALYSIS_RUN_REPOSITORY)
    private readonly analysisRunRepository: AnalysisRunRepository,
    @Inject(AGENT_RUN_REPOSITORY)
    private readonly agentRunRepository: AgentRunRepository,
    @Inject(FINDING_REPOSITORY)
    private readonly findingRepository: FindingRepository,
    @Inject(TOOL_CALL_REPOSITORY)
    private readonly toolCallRepository: ToolCallRepository,
    @Inject(TRACE_EVENT_REPOSITORY)
    private readonly traceEventRepository: TraceEventRepository,
  ) {}

  async getTrace(analysisRunId: string): Promise<AnalysisTrace> {
    const analysisRun =
      await this.analysisRunRepository.findById(analysisRunId);
    if (!analysisRun) {
      throw new NotFoundException(`Analysis run ${analysisRunId} not found`);
    }

    const [agentRuns, findings, events] = await Promise.all([
      this.agentRunRepository.findByAnalysisRunId(analysisRunId),
      this.findingRepository.findByAnalysisRunIdWithAgentType(analysisRunId),
      this.traceEventRepository.findByAnalysisRunId(analysisRunId),
    ]);
    const toolCalls = await this.toolCallRepository.findByAgentRunIds(
      agentRuns.map(({ id }) => id),
    );

    const agents = agentRuns.map<AgentTraceSummary>((agentRun) => {
      const agentEvents = events.filter(
        ({ agentRunId }) => agentRunId === agentRun.id,
      );
      const agentFindings = findings.filter(
        ({ agentRunId }) => agentRunId === agentRun.id,
      );
      const terminalModelEvents = agentEvents.filter(({ eventType }) =>
        ['model.request.completed', 'model.request.failed'].includes(eventType),
      );
      const tokenUsage = this.tokenUsage(terminalModelEvents);
      const completedEvent = [...agentEvents]
        .reverse()
        .find(({ eventType }) => eventType === 'agent.completed');
      const promptEvent = agentEvents.find(({ eventType }) =>
        ['agent.started', 'agent.reused'].includes(eventType),
      );

      return {
        agentRunId: agentRun.id,
        agentType: agentRun.agentType,
        status: agentRun.status,
        model: agentRun.model,
        promptVersion: this.stringMetadata(promptEvent, 'promptVersion'),
        reused: agentEvents.some(
          ({ eventType }) => eventType === 'agent.reused',
        ),
        durationMs:
          this.numberMetadata(completedEvent, 'durationMs') ??
          this.duration(agentRun.startedAt, agentRun.completedAt),
        findingCount: agentFindings.length,
        severityCounts: this.severityCounts(
          agentFindings.map(({ severity }) => severity),
        ),
        modelCallCount: agentEvents.filter(
          ({ eventType }) => eventType === 'model.request.started',
        ).length,
        toolCallCount: toolCalls.filter(
          ({ agentRunId }) => agentRunId === agentRun.id,
        ).length,
        ...tokenUsage,
      };
    });
    const allModelTerminalEvents = events.filter(({ eventType }) =>
      ['model.request.completed', 'model.request.failed'].includes(eventType),
    );
    const totalTokenUsage = this.tokenUsage(allModelTerminalEvents);
    const reusedAgents = agents.filter(({ reused }) => reused).length;
    const executedAgentIds = new Set(
      events
        .filter(({ eventType }) => eventType === 'agent.started')
        .map(({ agentRunId }) => agentRunId),
    );

    return {
      summary: {
        analysisRunId,
        status: analysisRun.status,
        totalDurationMs: this.duration(
          analysisRun.startedAt,
          analysisRun.completedAt,
        ),
        attempts: analysisRun.attemptCount,
        retries: Math.max(0, analysisRun.attemptCount - 1),
        agents,
        totals: {
          executedAgents: agents.filter(({ agentRunId }) =>
            executedAgentIds.has(agentRunId),
          ).length,
          reusedAgents,
          failedAgents: agents.filter(({ status }) => status === 'failed')
            .length,
          modelCalls: events.filter(
            ({ eventType }) => eventType === 'model.request.started',
          ).length,
          toolCalls: toolCalls.length,
          findings: findings.length,
          severityCounts: this.severityCounts(
            findings.map(({ severity }) => severity),
          ),
          ...totalTokenUsage,
        },
      },
      events,
    };
  }

  private tokenUsage(events: TraceEvent[]): TokenUsageSummary {
    const completed = events.filter(
      ({ eventType }) => eventType === 'model.request.completed',
    );
    const values = completed.map((event) => ({
      input: this.numberMetadata(event, 'inputTokens'),
      output: this.numberMetadata(event, 'outputTokens'),
      total: this.numberMetadata(event, 'totalTokens'),
    }));
    const usageComplete =
      events.length > 0 &&
      completed.length === events.length &&
      values.every(
        ({ input, output, total }) =>
          input != null && output != null && total != null,
      );
    return {
      usageComplete,
      inputTokens: usageComplete
        ? values.reduce((sum, value) => sum + value.input!, 0)
        : null,
      outputTokens: usageComplete
        ? values.reduce((sum, value) => sum + value.output!, 0)
        : null,
      totalTokens: usageComplete
        ? values.reduce((sum, value) => sum + value.total!, 0)
        : null,
    };
  }

  private severityCounts(severities: FindingSeverity[]): TraceSeverityCounts {
    const counts = { ...EMPTY_SEVERITIES };
    for (const severity of severities) counts[severity] += 1;
    return counts;
  }

  private duration(start: Date | null, end: Date | null): number | null {
    return start && end ? Math.max(0, end.getTime() - start.getTime()) : null;
  }

  private numberMetadata(
    event: TraceEvent | undefined,
    key: string,
  ): number | null {
    const value = event?.metadata[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private stringMetadata(
    event: TraceEvent | undefined,
    key: string,
  ): string | null {
    const value = event?.metadata[key];
    return typeof value === 'string' ? value : null;
  }
}
