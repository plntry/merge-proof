CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);