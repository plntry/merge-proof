import type { Pool } from 'pg';

import { PostgresToolCallRepository } from './postgres-tool-call.repository.js';

describe('PostgresToolCallRepository', () => {
  const now = new Date();
  const baseRow = {
    id: 'tool-call-id',
    agent_run_id: 'agent-run-id',
    tool_name: 'getChangedFiles',
    arguments: { repository: 'merge-proof', pullRequestNumber: 42 },
    result: null,
    status: 'pending' as const,
    error_message: null,
    created_at: now,
    started_at: null,
    completed_at: null,
  };
  let query: ReturnType<typeof vi.fn>;
  let repository: PostgresToolCallRepository;

  beforeEach(() => {
    query = vi.fn();
    repository = new PostgresToolCallRepository({ query } as unknown as Pool);
  });

  it('serializes arguments as JSON for the JSONB column', async () => {
    query.mockResolvedValue({ rows: [baseRow] });

    await repository.save({
      id: 'tool-call-id',
      agentRunId: 'agent-run-id',
      toolName: 'getChangedFiles',
      arguments: { repository: 'merge-proof', pullRequestNumber: 42 },
      status: 'pending',
    });

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      'tool-call-id',
      'agent-run-id',
      'getChangedFiles',
      JSON.stringify({ repository: 'merge-proof', pullRequestNumber: 42 }),
      'pending',
    ]);
  });

  it('serializes array results as JSON rather than PostgreSQL arrays', async () => {
    const result = [{ path: 'src/file.ts', status: 'modified' }];
    query.mockResolvedValue({
      rows: [
        {
          ...baseRow,
          status: 'completed',
          result,
          completed_at: now,
        },
      ],
    });

    await repository.markCompleted('tool-call-id', result);

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      'tool-call-id',
      JSON.stringify(result),
    ]);
  });
});
