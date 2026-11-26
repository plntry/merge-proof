ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

UPDATE agent_runs
SET lease_token = gen_random_uuid(),
    lease_expires_at = NOW() + INTERVAL '60 seconds'
WHERE status = 'running';

CREATE INDEX IF NOT EXISTS agent_runs_expired_lease_idx
ON agent_runs (lease_expires_at)
WHERE status = 'running';
