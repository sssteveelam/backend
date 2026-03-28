-- PR4 issues read APIs indexes (PROPOSED NEW API support)
CREATE INDEX IF NOT EXISTS issues_created_at_idx ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS pick_tasks_status_created_at_idx ON pick_tasks(status, created_at DESC);
