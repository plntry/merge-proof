import type { Pool } from 'pg';
import type { PoolClient } from 'pg';

import { PostgresTraceEventRepository } from './postgres-trace-event.repository.js';

describe('PostgresTraceEventRepository', () => {
  it('appends compact metadata and reads events in chronological order', async () => {
    const now = new Date();
    const row = {
      id: 'event-id',
      analysis_run_id: 'analysis-id',
      agent_run_id: null,
      tool_call_id: null,
      event_type: 'analysis.started' as const,
      metadata: { attempt: 1 },
      created_at: now,
    };
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = new PostgresTraceEventRepository({
      query,
    } as unknown as Pool);

    await repository.append({
      id: row.id,
      analysisRunId: row.analysis_run_id,
      agentRunId: null,
      toolCallId: null,
      eventType: row.event_type,
      metadata: row.metadata,
    });
    await repository.findByAnalysisRunId(row.analysis_run_id);

    expect(query.mock.calls[0][1][5]).toBe(JSON.stringify(row.metadata));
    expect(query.mock.calls[1][0]).toContain('ORDER BY created_at ASC');
  });

  it('rolls back only the trace savepoint when an in-transaction write fails', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('trace insert failed'))
      .mockResolvedValue({ rows: [] });
    const repository = new PostgresTraceEventRepository({} as Pool);

    await expect(
      repository.append(
        {
          id: 'event-id',
          analysisRunId: 'analysis-id',
          agentRunId: null,
          toolCallId: null,
          eventType: 'analysis.started',
          metadata: {},
        },
        { query } as unknown as PoolClient,
      ),
    ).rejects.toThrow('trace insert failed');

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'SAVEPOINT trace_event_append',
      expect.stringContaining('INSERT INTO trace_events'),
      'ROLLBACK TO SAVEPOINT trace_event_append',
      'RELEASE SAVEPOINT trace_event_append',
    ]);
  });
});
