-- PR2 receipts read APIs indexes (PROPOSED NEW API support)
CREATE INDEX IF NOT EXISTS receipts_created_at_idx ON receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS receipts_supplier_id_created_at_idx ON receipts(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS receipts_warehouse_id_created_at_idx ON receipts(warehouse_id, created_at DESC);
