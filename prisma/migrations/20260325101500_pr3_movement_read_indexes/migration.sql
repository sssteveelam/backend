-- PR3 movement read APIs indexes (PROPOSED NEW API support)
CREATE INDEX IF NOT EXISTS movements_created_at_idx ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS movements_from_location_id_created_at_idx ON movements(from_location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS movements_to_location_id_created_at_idx ON movements(to_location_id, created_at DESC);
