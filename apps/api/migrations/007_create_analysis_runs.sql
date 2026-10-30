CREATE TABLE analysis_runs (
  id UUID PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES reviews(id),
  status TEXT NOT NULL CHECK (
    status IN (
      'pending',
      'running',
      'completed',
      'failed',
      'needs_review'
    )
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);