CREATE TABLE trace_events (
  id UUID PRIMARY KEY,
  analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id),
  agent_run_id UUID REFERENCES agent_runs(id),
  tool_call_id UUID REFERENCES tool_calls(id),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'analysis.started',
      'analysis.completed',
      'analysis.failed',
      'agent.started',
      'agent.completed',
      'agent.failed',
      'agent.reused',
      'model.request.started',
      'model.request.completed',
      'model.request.failed',
      'tool.started',
      'tool.completed',
      'tool.failed',
      'findings.projected',
      'assessment.calculated'
    )
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (
    JSONB_TYPEOF(metadata) = 'object'
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX trace_events_analysis_run_id_created_at_idx
ON trace_events (analysis_run_id, created_at);

CREATE INDEX trace_events_agent_run_id_idx
ON trace_events (agent_run_id)
WHERE agent_run_id IS NOT NULL;

CREATE INDEX trace_events_event_type_idx
ON trace_events (event_type);
