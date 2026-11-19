import type { Job } from 'bullmq';

import type { AnalysisOrchestrator } from './orchestration/analysis-orchestrator.service.js';
import type { AnalysisRunRepository } from './repositories/analysis-run-repository.interface.js';
import { AnalysisProcessor } from './analysis.processor.js';
import { ANALYZE_REVIEW_JOB } from './analysis-runs.constants.js';

describe('AnalysisProcessor', () => {
  const run = {
    id: 'analysis-run-id',
    reviewId: 'review-id',
    status: 'running' as const,
    attemptCount: 1,
    createdAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    errorMessage: null,
  };
  let repository: AnalysisRunRepository;
  let orchestratorRun: ReturnType<typeof vi.fn>;
  let markCompleted: ReturnType<typeof vi.fn>;
  let markNeedsReview: ReturnType<typeof vi.fn>;
  let markFailed: ReturnType<typeof vi.fn>;
  let processor: AnalysisProcessor;
  let recalculate: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    markCompleted = vi.fn().mockResolvedValue({ ...run, status: 'completed' });
    markNeedsReview = vi
      .fn()
      .mockResolvedValue({ ...run, status: 'needs_review' });
    markFailed = vi.fn().mockResolvedValue({ ...run, status: 'failed' });
    repository = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue({ ...run, status: 'pending' }),
      markRunning: vi.fn().mockResolvedValue(run),
      markCompleted,
      markNeedsReview,
      markFailed,
    };
    orchestratorRun = vi.fn();
    recalculate = vi.fn().mockResolvedValue(undefined);
    record = vi.fn().mockResolvedValue(undefined);
    processor = new AnalysisProcessor(
      repository,
      {
        run: orchestratorRun,
      } as unknown as AnalysisOrchestrator,
      { recalculate } as never,
      { record } as never,
    );
  });

  function job(attemptsMade: number, attempts = 3): Job {
    return {
      name: ANALYZE_REVIEW_JOB,
      data: { analysisRunId: run.id },
      attemptsMade,
      opts: { attempts },
    } as Job;
  }

  it('marks the analysis completed when every agent succeeds', async () => {
    orchestratorRun.mockResolvedValue({
      agents: [],
      completedAgents: ['requirements', 'security', 'architecture', 'tests'],
      failedAgents: [],
    });

    await processor.process(job(0));

    expect(markCompleted).toHaveBeenCalledWith(run.id);
    expect(recalculate).toHaveBeenCalledWith(run.id);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'analysis.completed',
        metadata: expect.objectContaining({ status: 'completed', attempt: 1 }),
      }),
    );
  });

  it('throws a partial failure while retries remain', async () => {
    orchestratorRun.mockResolvedValue({
      agents: [],
      completedAgents: ['requirements', 'security', 'tests'],
      failedAgents: ['architecture'],
    });

    await expect(processor.process(job(0))).rejects.toThrow(
      'Agents failed: architecture',
    );
    expect(markNeedsReview).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(recalculate).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'analysis.failed',
        metadata: expect.objectContaining({ willRetry: true }),
      }),
    );
  });

  it('marks final partial success as needs_review', async () => {
    orchestratorRun.mockResolvedValue({
      agents: [],
      completedAgents: ['requirements', 'security', 'tests'],
      failedAgents: ['architecture'],
    });

    await processor.process(job(2));

    expect(markNeedsReview).toHaveBeenCalledWith(
      run.id,
      'Agents failed: architecture',
    );
    expect(markFailed).not.toHaveBeenCalled();
    expect(recalculate).toHaveBeenCalledWith(run.id);
  });

  it('marks all-agent failure failed on the final attempt', async () => {
    orchestratorRun.mockResolvedValue({
      agents: [],
      completedAgents: [],
      failedAgents: ['requirements', 'security', 'architecture', 'tests'],
    });

    await expect(processor.process(job(2))).rejects.toThrow(
      'Agents failed: requirements, security, architecture, tests',
    );
    expect(markFailed).toHaveBeenCalledWith(
      run.id,
      'Agents failed: requirements, security, architecture, tests',
    );
    expect(recalculate).not.toHaveBeenCalled();
  });
});
