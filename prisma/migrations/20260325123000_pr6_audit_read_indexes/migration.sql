-- PR6 audit read APIs indexes (PROPOSED NEW API support)
CREATE INDEX IF NOT EXISTS audit_events_created_at_desc_idx
ON audit_events(created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_entity_type_entity_id_created_at_desc_idx
ON audit_events(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_actor_user_id_created_at_desc_idx
ON audit_events(actor_user_id, created_at DESC);

