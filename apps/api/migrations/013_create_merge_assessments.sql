CREATE TABLE merge_assessments (
  id UUID PRIMARY KEY,
  analysis_run_id UUID NOT NULL UNIQUE REFERENCES analysis_runs(id),
  decision TEXT NOT NULL CHECK (
    decision IN ('ready', 'needs_review', 'blocked')
  ),
  risk_score INTEGER NOT NULL CHECK (
    risk_score >= 0 AND risk_score <= 100
  ),
  reasons JSONB NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX merge_assessments_analysis_run_id_idx
ON merge_assessments (analysis_run_id);
