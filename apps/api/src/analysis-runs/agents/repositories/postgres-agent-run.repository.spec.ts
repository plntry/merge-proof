import type { Pool } from 'pg';

import { PostgresAgentRunRepository } from './postgres-agent-run.repository.js';

describe('PostgresAgentRunRepository', () => {
  const row = {
    id: 'agent-run-id',
    analysis_run_id: 'analysis-run-id',
    agent_type: 'security' as const,
    status: 'pending' as const,
    model: 'test-model',
    output: null,
    error_message: null,
    created_at: new Date(),
    started_at: null,
    completed_at: null,
  };
  let query: ReturnType<typeof vi.fn>;
  let repository: PostgresAgentRunRepository;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rows: [row] });
    repository = new PostgresAgentRunRepository({ query } as unknown as Pool);
  });

  it('atomically returns the unique analysis-and-agent row', async () => {
    await repository.findOrCreate({
      id: 'new-id',
      analysisRunId: 'analysis-run-id',
      agentType: 'security',
      status: 'pending',
      model: 'test-model',
    });

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT (analysis_run_id, agent_type)');
    expect(sql).toContain('RETURNING *');
  });

  it('guards lifecycle transitions by current status', async () => {
    await repository.markRunning('agent-run-id');
    await repository.markCompleted('agent-run-id', { findings: [] });
    await repository.markFailed('agent-run-id', 'failed');

    expect(query.mock.calls[0][0]).toContain(
      "status IN ('pending', 'failed')",
    );
    expect(query.mock.calls[1][0]).toContain("status = 'running'");
    expect(query.mock.calls[2][0]).toContain("status = 'running'");
  });
});
