-- Plan 05: Movement + admin adjustment hard constraints
-- 1) Idempotency key uniqueness per actor and route
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'idempotency_keys_route_key_actor_user_id_key'
  ) THEN
    ALTER TABLE "idempotency_keys"
      ADD CONSTRAINT "idempotency_keys_route_key_actor_user_id_key"
      UNIQUE ("route", "key", "actor_user_id");
  END IF;
END $$;

-- 2) Enforce movement line quantity > 0 at DB level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'movement_lines_quantity_base_positive_check'
  ) THEN
    ALTER TABLE "movement_lines"
      ADD CONSTRAINT "movement_lines_quantity_base_positive_check"
      CHECK ("quantity_base" > 0);
  END IF;
END $$;

-- 3) Enforce stock line quantity >= 0 at DB level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_lines_quantity_base_non_negative_check'
  ) THEN
    ALTER TABLE "stock_lines"
      ADD CONSTRAINT "stock_lines_quantity_base_non_negative_check"
      CHECK ("quantity_base" >= 0);
  END IF;
END $$;
