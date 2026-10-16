CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  repository TEXT NOT NULL,
  pull_request_number INTEGER NOT NULL CHECK (pull_request_number > 0),
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'in_progress', 'completed', 'failed')
  )
);