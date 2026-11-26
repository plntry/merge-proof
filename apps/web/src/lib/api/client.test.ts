import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReview, subscribeToAnalysis } from './client';

class FakeEventSource {
  static latest: FakeEventSource | undefined;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  readonly listeners = new Map<string, (event: Event) => void>();

  constructor(readonly url: string) {
    FakeEventSource.latest = this;
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: string) {
    this.listeners.get(type)?.({ data } as MessageEvent<string>);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('web API client', () => {
  it('posts a review and returns its analysis run identity', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 'review-id', analysisRunId: 'analysis-id' }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createReview({
      organizationId: 'organization-id',
      repository: 'team/project',
      pullRequestNumber: 7,
    })).resolves.toEqual({ id: 'review-id', analysisRunId: 'analysis-id' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/reviews',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          organizationId: 'organization-id',
          repository: 'team/project',
          pullRequestNumber: 7,
        }),
        cache: 'no-store',
      }),
    );
  });

  it('subscribes to snapshots, reports reconnect state, closes at terminal state, and cleans up', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
    vi.stubGlobal('EventSource', FakeEventSource);
    const snapshots: unknown[] = [];
    const connections: boolean[] = [];
    const cleanup = subscribeToAnalysis('analysis-id', (snapshot) => snapshots.push(snapshot), (connected) => connections.push(connected));
    const stream = FakeEventSource.latest;
    if (!stream) throw new Error('EventSource was not constructed');
    expect(stream.url).toBe('http://localhost:3001/analysis-runs/analysis-id/events');

    stream.onopen?.();
    stream.onerror?.();
    stream.emit('snapshot', JSON.stringify({
      analysisRun: { id: 'analysis-id', status: 'completed', attemptCount: 1 },
      agents: [], assessment: null, findingCount: 0, updatedAt: '2026-11-26T10:00:00.000Z',
    }));

    expect(connections).toEqual([true, false]);
    expect(snapshots).toHaveLength(1);
    expect(stream.closed).toBe(true);
    cleanup();
    expect(stream.closed).toBe(true);
  });
});
