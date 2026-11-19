ALTER TABLE findings
ADD COLUMN source_index INTEGER;

WITH ranked_findings AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY agent_run_id
      ORDER BY created_at ASC, id ASC
    ) - 1 AS source_index
  FROM findings
)
UPDATE findings
SET source_index = ranked_findings.source_index
FROM ranked_findings
WHERE findings.id = ranked_findings.id;

ALTER TABLE findings
ALTER COLUMN source_index SET NOT NULL;

ALTER TABLE findings
ADD CONSTRAINT findings_source_index_non_negative
CHECK (source_index >= 0);

ALTER TABLE findings
ADD CONSTRAINT findings_agent_run_source_index_unique
UNIQUE (agent_run_id, source_index);

CREATE TABLE finding_reviews (
  id UUID PRIMARY KEY,
  finding_id UUID NOT NULL UNIQUE REFERENCES findings(id),
  status TEXT NOT NULL CHECK (
    status IN ('accepted', 'rejected', 'edited')
  ),
  edited_title TEXT,
  edited_description TEXT,
  edited_severity TEXT CHECK (
    edited_severity IS NULL
    OR edited_severity IN ('low', 'medium', 'high', 'critical')
  ),
  review_note TEXT CHECK (
    review_note IS NULL OR CHAR_LENGTH(review_note) <= 2000
  ),
  reviewed_by TEXT CHECK (
    reviewed_by IS NULL OR CHAR_LENGTH(reviewed_by) <= 200
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      status = 'edited'
      AND edited_title IS NOT NULL
      AND CHAR_LENGTH(BTRIM(edited_title)) > 0
      AND CHAR_LENGTH(edited_title) <= 300
      AND edited_description IS NOT NULL
      AND CHAR_LENGTH(BTRIM(edited_description)) > 0
      AND CHAR_LENGTH(edited_description) <= 5000
      AND edited_severity IS NOT NULL
    )
    OR
    (
      status IN ('accepted', 'rejected')
      AND edited_title IS NULL
      AND edited_description IS NULL
      AND edited_severity IS NULL
    )
  )
);

CREATE INDEX finding_reviews_finding_id_idx
ON finding_reviews (finding_id);
