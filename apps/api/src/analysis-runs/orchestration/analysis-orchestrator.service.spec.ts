import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

import type { AnalysisAgent } from '../agents/analysis-agent.interface.js';
import type { AgentType } from '../agents/analysis-agent.types.js';
import type { AgentRun, NewAgentRun } from '../agents/agent-run.types.js';
import type { AgentRunRepository } from '../agents/repositories/agent-run.repository.interface.js';
import type { FindingProjectionService } from '../findings/finding-projection.service.js';
import type { AnalysisContextRepository } from '../repositories/analysis-context-repository.interface.js';
import { AnalysisOrchestrator } from './analysis-orchestrator.service.js';
import { MockRepositorySource } from '../tools/mock-repository-source.service.js';

function createRun(input: NewAgentRun): AgentRun {
  return {
    ...input,
    output: null,
    errorMessage: null,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
  };
}

describe('AnalysisOrchestrator', () => {
  const context = {
    analysisRunId: 'analysis-run-id',
    reviewId: 'review-id',
    repository: 'merge-proof',
    pullRequestNumber: 42,
  };

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  function setup(agents: AnalysisAgent[], seededRuns: AgentRun[] = []) {
    const runs = new Map<string, AgentRun>(
      seededRuns.map((run) => [`${run.analysisRunId}:${run.agentType}`, run]),
    );
    const markFailed = vi.fn(async (id: string, errorMessage: string) => {
      const entry = [...runs.entries()].find(([, run]) => run.id === id);
      if (!entry || entry[1].status !== 'running') return undefined;
      const failed: AgentRun = {
        ...entry[1],
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      };
      runs.set(entry[0], failed);
      return failed;
    });
    const repository: AgentRunRepository = {
      findByAnalysisRunId: vi.fn(async (analysisRunId) =>
        [...runs.values()].filter((run) => run.analysisRunId === analysisRunId),
      ),
      findOrCreate: vi.fn(async (input) => {
        const key = `${input.analysisRunId}:${input.agentType}`;
        const existing = runs.get(key);
        if (existing) return existing;
        const created = createRun(input);
        runs.set(key, created);
        return created;
      }),
      findByAnalysisRunAndType: vi.fn(async (analysisRunId, agentType) =>
        runs.get(`${analysisRunId}:${agentType}`),
      ),
      markRunning: vi.fn(async (id) => {
        const entry = [...runs.entries()].find(([, run]) => run.id === id);
        if (!entry || !['pending', 'failed'].includes(entry[1].status)) {
          return undefined;
        }
        const running: AgentRun = {
          ...entry[1],
          status: 'running',
          startedAt: entry[1].startedAt ?? new Date(),
          completedAt: null,
          errorMessage: null,
        };
        runs.set(entry[0], running);
        return running;
      }),
      markCompleted: vi.fn(async (id, output) => {
        const entry = [...runs.entries()].find(([, run]) => run.id === id);
        if (!entry || entry[1].status !== 'running') return undefined;
        const completed: AgentRun = {
          ...entry[1],
          status: 'completed',
          output,
          completedAt: new Date(),
          errorMessage: null,
        };
        runs.set(entry[0], completed);
        return completed;
      }),
      markFailed,
    };
    const projectAgentOutput = vi.fn(
      async (_analysisRunId: string, _agentRunId: string, output: unknown) =>
        (output as { findings: unknown[] }).findings.length,
    );
    const orchestrator = new AnalysisOrchestrator(
      agents,
      {
        findByAnalysisRunId: vi.fn().mockResolvedValue(context),
      } as unknown as AnalysisContextRepository,
      repository,
      { projectAgentOutput } as unknown as FindingProjectionService,
      {
        getOrThrow: vi.fn().mockReturnValue('test-model'),
      } as unknown as ConfigService,
    );

    return { orchestrator, repository, runs, projectAgentOutput, markFailed };
  }

  function agent(
    type: AgentType,
    run: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({ findings: [] }),
  ): AnalysisAgent {
    return { type, run };
  }

  it('starts all four independent agents concurrently', async () => {
    let started = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const agents = (
      ['requirements', 'security', 'architecture', 'tests'] as const
    ).map((type) =>
      agent(
        type,
        vi.fn(async () => {
          started += 1;
          if (started === 4) release?.();
          await gate;
          return { findings: [] };
        }),
      ),
    );
    const { orchestrator } = setup(agents);

    const result = await orchestrator.run(context.analysisRunId);

    expect(started).toBe(4);
    expect(result.completedAgents).toEqual([
      'requirements',
      'security',
      'architecture',
      'tests',
    ]);
    expect(result.failedAgents).toEqual([]);
  });

  it('reuses completed agent runs and re-projects their output', async () => {
    const agentTypes = [
      'requirements',
      'security',
      'architecture',
      'tests',
    ] as const;
    const runMocks = agentTypes.map(() =>
      vi.fn().mockResolvedValue({ findings: [] }),
    );
    const agents = agentTypes.map((type, index) =>
      agent(type, runMocks[index]),
    );
    const seeded = agents.map((item, index) => ({
      ...createRun({
        id: `run-${item.type}`,
        analysisRunId: context.analysisRunId,
        agentType: item.type,
        status: 'completed',
        model: 'test-model',
      }),
      output: { findings: index === 0 ? [] : [{ title: item.type }] },
      completedAt: new Date(),
    }));
    const { orchestrator, projectAgentOutput } = setup(agents, seeded);

    const result = await orchestrator.run(context.analysisRunId);

    expect(result.completedAgents).toHaveLength(4);
    expect(runMocks.every((run) => run.mock.calls.length === 0)).toBe(true);
    expect(projectAgentOutput).toHaveBeenCalledTimes(4);
  });

  it('preserves successes and retries only the failed agent', async () => {
    const runsByType = {
      requirements: vi.fn().mockResolvedValue({ findings: [] }),
      security: vi.fn().mockResolvedValue({ findings: [] }),
      architecture: vi
        .fn()
        .mockRejectedValueOnce(new Error('architecture failed'))
        .mockResolvedValueOnce({ findings: [{ title: 'architecture' }] }),
      tests: vi.fn().mockResolvedValue({ findings: [] }),
    };
    const agents = (
      ['requirements', 'security', 'architecture', 'tests'] as const
    ).map((type) => agent(type, runsByType[type]));
    const { orchestrator, runs } = setup(agents);

    const first = await orchestrator.run(context.analysisRunId);
    const second = await orchestrator.run(context.analysisRunId);

    expect(first.completedAgents).toEqual([
      'requirements',
      'security',
      'tests',
    ]);
    expect(first.failedAgents).toEqual(['architecture']);
    expect(second.completedAgents).toHaveLength(4);
    expect(runsByType.requirements).toHaveBeenCalledOnce();
    expect(runsByType.security).toHaveBeenCalledOnce();
    expect(runsByType.tests).toHaveBeenCalledOnce();
    expect(runsByType.architecture).toHaveBeenCalledTimes(2);
    expect(runs.size).toBe(4);
  });

  it('reports all-agent failure without losing individual errors', async () => {
    const agents = (
      ['requirements', 'security', 'architecture', 'tests'] as const
    ).map((type) =>
      agent(type, vi.fn().mockRejectedValue(new Error(`${type} failed`))),
    );
    const { orchestrator } = setup(agents);

    const result = await orchestrator.run(context.analysisRunId);

    expect(result.completedAgents).toEqual([]);
    expect(result.failedAgents).toEqual([
      'requirements',
      'security',
      'architecture',
      'tests',
    ]);
    expect(result.agents.every((summary) => summary.errorMessage)).toBe(true);
  });

  it('does not fail an agent run claimed by another execution', async () => {
    const running = {
      ...createRun({
        id: 'running-agent-id',
        analysisRunId: context.analysisRunId,
        agentType: 'requirements',
        status: 'running',
        model: 'test-model',
      }),
      startedAt: new Date(),
    };
    const { orchestrator, markFailed } = setup(
      [agent('requirements')],
      [running],
    );

    const result = await orchestrator.run(context.analysisRunId);

    expect(result.failedAgents).toEqual(['requirements']);
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('runs four differentiated analyses against fixture PR 42', async () => {
    const source = new MockRepositorySource();
    const finding = (title: string) => ({
      findings: [
        {
          title,
          description: 'Supported by merge-proof#42 fixture evidence.',
          severity: 'medium' as const,
          confidence: 0.9,
        },
      ],
    });
    const agents: AnalysisAgent[] = [
      agent(
        'requirements',
        vi.fn(async () => {
          const metadata = await source.getPrMetadata({
            repository: 'merge-proof',
            pullRequestNumber: 42,
          });
          expect(metadata.description).toContain('successfully created');
          return finding('Credit consumption contradicts the requirement');
        }),
      ),
      agent(
        'security',
        vi.fn(async () => {
          const controller = await source.getFileContent({
            repository: 'merge-proof',
            path: 'src/reviews/reviews.controller.ts',
          });
          expect(controller.content).toContain('reviewsService.create(dto)');
          return finding('Organization access is not enforced');
        }),
      ),
      agent(
        'architecture',
        vi.fn(async () => {
          const service = await source.getFileContent({
            repository: 'merge-proof',
            path: 'src/reviews/reviews.service.ts',
          });
          expect(service.content.indexOf('consumeCredit')).toBeLessThan(
            service.content.indexOf('reviewRepository.save'),
          );
          return finding('Credit and review writes are not atomic');
        }),
      ),
      agent(
        'tests',
        vi.fn(async () => {
          const tests = await source.getFileContent({
            repository: 'merge-proof',
            path: 'src/reviews/reviews.service.spec.ts',
          });
          expect(tests.content).not.toContain('reviewRepository.save');
          return finding('Save-failure credit behavior is untested');
        }),
      ),
    ];
    const { orchestrator } = setup(agents);

    const result = await orchestrator.run(context.analysisRunId);

    expect(result.failedAgents).toEqual([]);
    expect(result.agents.map((summary) => summary.findingCount)).toEqual([
      1, 1, 1, 1,
    ]);
  });
});
