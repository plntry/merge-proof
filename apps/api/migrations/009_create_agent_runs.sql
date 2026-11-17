CREATE TABLE agent_runs (
  id UUID PRIMARY KEY,
  analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id),
  agent_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'pending',
      'running',
      'completed',
      'failed'
    )
  ),
  model TEXT NOT NULL,
  output JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (analysis_run_id, agent_type)
);