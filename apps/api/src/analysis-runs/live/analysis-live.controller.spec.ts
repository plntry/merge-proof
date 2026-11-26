import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisLiveController } from './analysis-live.controller.js';
import type { AnalysisLiveService } from './analysis-live.service.js';
import type { AnalysisLiveSnapshot } from './analysis-live.types.js';

function snapshot(status: AnalysisLiveSnapshot['analysisRun']['status']): AnalysisLiveSnapshot {
  return {
    analysisRun: { id: 'analysis-id', status, attemptCount: 1 },
    agents: [],
    assessment: null,
    findingCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

describe('AnalysisLiveController', () => {
  afterEach(() => vi.useRealTimers());

  it('sends an authoritative snapshot immediately and completes on terminal state', async () => {
    const persistedSnapshot = snapshot('completed');
    const service = { snapshot: vi.fn().mockResolvedValue(persistedSnapshot) };
    const controller = new AnalysisLiveController(service as unknown as AnalysisLiveService);

    await expect(firstValueFrom(controller.events('analysis-id'))).resolves.toMatchObject({
      type: 'snapshot',
      data: persistedSnapshot,
    });
    expect(service.snapshot).toHaveBeenCalledWith('analysis-id');
  });

  it('starts a reconnect with the latest persisted snapshot', async () => {
    const service = {
      snapshot: vi.fn()
        .mockResolvedValueOnce(snapshot('running'))
        .mockResolvedValueOnce(snapshot('completed')),
    };
    const controller = new AnalysisLiveController(service as unknown as AnalysisLiveService);

    const firstConnection = await firstValueFrom(controller.events('analysis-id'));
    const reconnected = await firstValueFrom(controller.events('analysis-id'));

    expect(firstConnection.data.analysisRun.status).toBe('running');
    expect(reconnected.data.analysisRun.status).toBe('completed');
    expect(service.snapshot).toHaveBeenCalledTimes(2);
  });

  it('clears the server poll interval when a client disconnects', async () => {
    vi.useFakeTimers();
    const service = { snapshot: vi.fn().mockResolvedValue(snapshot('running')) };
    const controller = new AnalysisLiveController(service as unknown as AnalysisLiveService);
    const subscription = controller.events('analysis-id').subscribe();
    await vi.waitFor(() => expect(service.snapshot).toHaveBeenCalledTimes(1));
    subscription.unsubscribe();

    await vi.advanceTimersByTimeAsync(5000);
    expect(service.snapshot).toHaveBeenCalledTimes(1);
  });

  it('requeries PostgreSQL-backed state for subsequent SSE snapshots', async () => {
    vi.useFakeTimers();
    const service = {
      snapshot: vi.fn()
        .mockResolvedValueOnce(snapshot('running'))
        .mockResolvedValueOnce(snapshot('completed')),
    };
    const controller = new AnalysisLiveController(service as unknown as AnalysisLiveService);
    const received: string[] = [];
    const subscription = controller.events('analysis-id').subscribe((event) => {
      received.push(event.data.analysisRun.status);
    });
    await vi.waitFor(() => expect(service.snapshot).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1500);
    await vi.waitFor(() => expect(received).toEqual(['running', 'completed']));

    expect(subscription.closed).toBe(true);
    expect(service.snapshot).toHaveBeenCalledTimes(2);
  });
});
