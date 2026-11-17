CREATE TABLE findings (
  id UUID PRIMARY KEY,
  analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (
    severity IN (
      'low',
      'medium',
      'high',
      'critical'
    )
  ),
  confidence DOUBLE PRECISION NOT NULL CHECK (
    confidence >= 0
    AND confidence <= 1
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);