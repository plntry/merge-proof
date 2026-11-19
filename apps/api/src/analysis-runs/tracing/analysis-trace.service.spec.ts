import { NotFoundException } from '@nestjs/common';

import { AnalysisTraceService } from './analysis-trace.service.js';
import type {
  TraceEvent,
  TraceEventType,
  TraceMetadata,
} from './trace-event.types.js';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function event(
  eventType: TraceEventType,
  metadata: TraceMetadata,
  agentRunId: string | null = 'agent-id',
): TraceEvent {
  return {
    id: `${eventType}-${Math.random()}`,
    analysisRunId: 'analysis-id',
    agentRunId,
    toolCallId: null,
    eventType,
    metadata,
    createdAt,
  };
}

describe('AnalysisTraceService', () => {
  function setup(events: TraceEvent[]) {
    return new AnalysisTraceService(
      {
        findById: vi.fn().mockResolvedValue({
          id: 'analysis-id',
          status: 'completed',
          attemptCount: 2,
          startedAt: createdAt,
          completedAt: new Date(createdAt.getTime() + 1000),
        }),
      } as never,
      {
        findByAnalysisRunId: vi.fn().mockResolvedValue([
          {
            id: 'agent-id',
            agentType: 'security',
            status: 'completed',
            model: 'fixture-model',
            startedAt: createdAt,
            completedAt: new Date(createdAt.getTime() + 300),
          },
        ]),
      } as never,
      {
        findByAnalysisRunIdWithAgentType: vi.fn().mockResolvedValue([
          {
            id: 'finding-id',
            agentRunId: 'agent-id',
            agentType: 'security',
            severity: 'high',
          },
        ]),
      } as never,
      {
        findByAgentRunIds: vi
          .fn()
          .mockResolvedValue([{ id: 'tool-id', agentRunId: 'agent-id' }]),
      } as never,
      { findByAnalysisRunId: vi.fn().mockResolvedValue(events) } as never,
    );
  }

  it('aggregates duration, reuse, calls, findings, tools and complete usage', async () => {
    const service = setup([
      event('agent.started', {
        agentType: 'security',
        promptVersion: 'security-v1',
      }),
      event('agent.completed', { durationMs: 250, findingCount: 1 }),
      event('agent.reused', {
        agentType: 'security',
        promptVersion: 'security-v1',
        findingCount: 1,
      }),
      event('model.request.started', { requestIndex: 0 }),
      event('model.request.completed', {
        requestIndex: 0,
        inputTokens: 10,
        outputTokens: 4,
        totalTokens: 14,
      }),
    ]);

    const trace = await service.getTrace('analysis-id');
    expect(trace.summary).toMatchObject({
      totalDurationMs: 1000,
      attempts: 2,
      retries: 1,
      totals: {
        executedAgents: 1,
        reusedAgents: 1,
        modelCalls: 1,
        toolCalls: 1,
        findings: 1,
        usageComplete: true,
        totalTokens: 14,
      },
    });
    expect(trace.summary.agents[0]).toMatchObject({
      promptVersion: 'security-v1',
      model: 'fixture-model',
      reused: true,
      durationMs: 250,
      findingCount: 1,
      modelCallCount: 1,
      toolCallCount: 1,
      severityCounts: { high: 1 },
    });
  });

  it('keeps token totals unknown when usage is missing', async () => {
    const service = setup([
      event('model.request.started', { requestIndex: 0 }),
      event('model.request.completed', {
        requestIndex: 0,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
      }),
    ]);
    const trace = await service.getTrace('analysis-id');
    expect(trace.summary.totals).toMatchObject({
      usageComplete: false,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    });
  });

  it('returns 404 for an unknown analysis', async () => {
    const service = new AnalysisTraceService(
      { findById: vi.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.getTrace('unknown')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
