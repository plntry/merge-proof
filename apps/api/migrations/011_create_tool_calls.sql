CREATE TABLE tool_calls (
  id UUID PRIMARY KEY,
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id),
  tool_name TEXT NOT NULL,
  arguments JSONB NOT NULL,
  result JSONB,
  status TEXT NOT NULL CHECK (
    status IN (
      'pending',
      'running',
      'completed',
      'failed'
    )
  ),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX tool_calls_agent_run_id_idx
ON tool_calls (agent_run_id);

CREATE INDEX tool_calls_created_at_idx
ON tool_calls (created_at);
