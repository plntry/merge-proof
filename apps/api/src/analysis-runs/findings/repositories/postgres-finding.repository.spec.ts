import type { Pool, PoolClient } from 'pg';

import { PostgresFindingRepository } from './postgres-finding.repository.js';

describe('PostgresFindingRepository', () => {
  it('preserves finding identity across reprojection without touching reviews', async () => {
    const createdAt = new Date();
    const existingRow = {
      id: 'stable-finding-id',
      analysis_run_id: 'analysis-id',
      agent_run_id: 'agent-id',
      source_index: 0,
      title: 'Original title',
      description: 'Original description',
      severity: 'high' as const,
      confidence: 0.8,
      created_at: createdAt,
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [existingRow] })
      .mockResolvedValueOnce({ rows: [] });
    const client = {
      query,
      release: vi.fn(),
    } as unknown as PoolClient;
    const repository = new PostgresFindingRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool);

    const saved = await repository.preserveForAgentRun('agent-id', [
      {
        id: 'new-random-id',
        analysisRunId: 'analysis-id',
        agentRunId: 'agent-id',
        sourceIndex: 0,
        title: 'Original title',
        description: 'Original description',
        severity: 'high',
        confidence: 0.8,
      },
    ]);

    expect(saved).toEqual([
      expect.objectContaining({ id: 'stable-finding-id', sourceIndex: 0 }),
    ]);
    expect(query.mock.calls[1][0]).toContain(
      'ON CONFLICT (agent_run_id, source_index) DO NOTHING',
    );
    expect(query.mock.calls[2][0]).toContain('FROM findings');
    expect(query.mock.calls.flatMap((call) => call).join(' ')).not.toContain(
      'finding_reviews',
    );
  });
});
