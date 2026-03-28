-- PR5 cycle-counts read APIs indexes (PROPOSED NEW API support)
-- NOTE: `cycle_counts.code` already has a UNIQUE index from initial schema migration.

CREATE INDEX IF NOT EXISTS cycle_counts_created_at_desc_idx ON cycle_counts(created_at DESC);
CREATE INDEX IF NOT EXISTS cycle_counts_status_created_at_desc_idx ON cycle_counts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS cycle_counts_location_id_created_at_desc_idx ON cycle_counts(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS cycle_count_lines_cycle_count_id_created_at_idx
ON cycle_count_lines(cycle_count_id, created_at ASC);

