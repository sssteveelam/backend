-- Baseline for missing Plan01-Plan04 migrations.
-- This migration is idempotent so existing databases are not destructively modified.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('staff', 'manager', 'admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "before_json" JSONB,
  "after_json" JSONB,
  "reason" TEXT,
  "correlation_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_events_entity_type_entity_id_created_at_idx"
ON "audit_events"("entity_type", "entity_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_events_actor_user_id_fkey'
  ) THEN
    ALTER TABLE "audit_events"
      ADD CONSTRAINT "audit_events_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "route" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idempotency_keys_route_key_actor_user_id_idx"
ON "idempotency_keys"("route", "key", "actor_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_keys_actor_user_id_fkey'
  ) THEN
    ALTER TABLE "idempotency_keys"
      ADD CONSTRAINT "idempotency_keys_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "warehouses" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_code_key" ON "warehouses"("code");

CREATE TABLE IF NOT EXISTS "locations" (
  "id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "locations_warehouse_id_code_key"
ON "locations"("warehouse_id", "code");
CREATE INDEX IF NOT EXISTS "locations_warehouse_id_idx" ON "locations"("warehouse_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locations_warehouse_id_fkey'
  ) THEN
    ALTER TABLE "locations"
      ADD CONSTRAINT "locations_warehouse_id_fkey"
      FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_code_key" ON "suppliers"("code");

CREATE TABLE IF NOT EXISTS "products" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "base_uom" TEXT NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "products_code_key" ON "products"("code");

CREATE TABLE IF NOT EXISTS "product_uoms" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "supplier_id" UUID,
  "uom" TEXT NOT NULL,
  "factor_to_base" DECIMAL(18, 6) NOT NULL,
  CONSTRAINT "product_uoms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "product_uoms_product_id_idx" ON "product_uoms"("product_id");
CREATE INDEX IF NOT EXISTS "product_uoms_supplier_id_idx" ON "product_uoms"("supplier_id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_uoms_product_id_supplier_id_uom_key"
ON "product_uoms"("product_id", "supplier_id", "uom");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_uoms_product_id_fkey'
  ) THEN
    ALTER TABLE "product_uoms"
      ADD CONSTRAINT "product_uoms_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_uoms_supplier_id_fkey'
  ) THEN
    ALTER TABLE "product_uoms"
      ADD CONSTRAINT "product_uoms_supplier_id_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "batches" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "supplier_id" UUID,
  "manufacture_date" DATE NOT NULL,
  "expiry_date" DATE NOT NULL,
  "lot_code" TEXT NOT NULL,
  "average_cost" DECIMAL(18, 6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "batches_product_id_supplier_id_manufacture_date_expiry_date_lot_code_key"
ON "batches"("product_id", "supplier_id", "manufacture_date", "expiry_date", "lot_code");
CREATE INDEX IF NOT EXISTS "batches_product_id_expiry_date_idx" ON "batches"("product_id", "expiry_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'batches_product_id_fkey'
  ) THEN
    ALTER TABLE "batches"
      ADD CONSTRAINT "batches_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'batches_supplier_id_fkey'
  ) THEN
    ALTER TABLE "batches"
      ADD CONSTRAINT "batches_supplier_id_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "containers" (
  "id" UUID NOT NULL,
  "qr_code" TEXT NOT NULL,
  "location_id" UUID NOT NULL,
  "status" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "containers_qr_code_key" ON "containers"("qr_code");
CREATE INDEX IF NOT EXISTS "containers_location_id_idx" ON "containers"("location_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'containers_location_id_fkey'
  ) THEN
    ALTER TABLE "containers"
      ADD CONSTRAINT "containers_location_id_fkey"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "stock_lines" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "container_id" UUID,
  "quantity_base" DECIMAL(18, 6) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_lines_product_id_batch_id_location_id_container_id_key"
ON "stock_lines"("product_id", "batch_id", "location_id", "container_id");
CREATE INDEX IF NOT EXISTS "stock_lines_product_id_location_id_idx"
ON "stock_lines"("product_id", "location_id");
CREATE INDEX IF NOT EXISTS "stock_lines_batch_id_idx" ON "stock_lines"("batch_id");
CREATE INDEX IF NOT EXISTS "stock_lines_container_id_idx" ON "stock_lines"("container_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_lines_product_id_fkey'
  ) THEN
    ALTER TABLE "stock_lines"
      ADD CONSTRAINT "stock_lines_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_lines_batch_id_fkey'
  ) THEN
    ALTER TABLE "stock_lines"
      ADD CONSTRAINT "stock_lines_batch_id_fkey"
      FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_lines_location_id_fkey'
  ) THEN
    ALTER TABLE "stock_lines"
      ADD CONSTRAINT "stock_lines_location_id_fkey"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_lines_container_id_fkey'
  ) THEN
    ALTER TABLE "stock_lines"
      ADD CONSTRAINT "stock_lines_container_id_fkey"
      FOREIGN KEY ("container_id") REFERENCES "containers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "receipts" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "supplier_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "total_value" DECIMAL(18, 6) NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "receipts_code_key" ON "receipts"("code");
CREATE INDEX IF NOT EXISTS "receipts_status_created_at_idx" ON "receipts"("status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipts_supplier_id_fkey'
  ) THEN
    ALTER TABLE "receipts"
      ADD CONSTRAINT "receipts_supplier_id_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipts_warehouse_id_fkey'
  ) THEN
    ALTER TABLE "receipts"
      ADD CONSTRAINT "receipts_warehouse_id_fkey"
      FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipts_created_by_fkey'
  ) THEN
    ALTER TABLE "receipts"
      ADD CONSTRAINT "receipts_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "receipt_lines" (
  "id" UUID NOT NULL,
  "receipt_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "supplier_id" UUID,
  "batch_id" UUID,
  "quantity" DECIMAL(18, 6) NOT NULL,
  "quantity_base" DECIMAL(18, 6),
  "uom" TEXT NOT NULL,
  "unit_cost" DECIMAL(18, 6) NOT NULL,
  "manufacture_date" DATE NOT NULL,
  "expiry_date" DATE NOT NULL,
  "lot_code" TEXT NOT NULL,
  "container_qr_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipt_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "receipt_lines_receipt_id_idx" ON "receipt_lines"("receipt_id");
CREATE INDEX IF NOT EXISTS "receipt_lines_product_id_idx" ON "receipt_lines"("product_id");
CREATE INDEX IF NOT EXISTS "receipt_lines_supplier_id_idx" ON "receipt_lines"("supplier_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_lines_receipt_id_fkey'
  ) THEN
    ALTER TABLE "receipt_lines"
      ADD CONSTRAINT "receipt_lines_receipt_id_fkey"
      FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_lines_product_id_fkey'
  ) THEN
    ALTER TABLE "receipt_lines"
      ADD CONSTRAINT "receipt_lines_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_lines_supplier_id_fkey'
  ) THEN
    ALTER TABLE "receipt_lines"
      ADD CONSTRAINT "receipt_lines_supplier_id_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_lines_batch_id_fkey'
  ) THEN
    ALTER TABLE "receipt_lines"
      ADD CONSTRAINT "receipt_lines_batch_id_fkey"
      FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "movements" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "from_location_id" UUID NOT NULL,
  "to_location_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "movements_code_key" ON "movements"("code");
CREATE INDEX IF NOT EXISTS "movements_status_created_at_idx" ON "movements"("status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movements_from_location_id_fkey'
  ) THEN
    ALTER TABLE "movements"
      ADD CONSTRAINT "movements_from_location_id_fkey"
      FOREIGN KEY ("from_location_id") REFERENCES "locations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movements_to_location_id_fkey'
  ) THEN
    ALTER TABLE "movements"
      ADD CONSTRAINT "movements_to_location_id_fkey"
      FOREIGN KEY ("to_location_id") REFERENCES "locations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movements_created_by_fkey'
  ) THEN
    ALTER TABLE "movements"
      ADD CONSTRAINT "movements_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "movement_lines" (
  "id" UUID NOT NULL,
  "movement_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "container_id" UUID,
  "quantity_base" DECIMAL(18, 6) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "movement_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "movement_lines_movement_id_idx" ON "movement_lines"("movement_id");
CREATE INDEX IF NOT EXISTS "movement_lines_product_id_idx" ON "movement_lines"("product_id");
CREATE INDEX IF NOT EXISTS "movement_lines_batch_id_idx" ON "movement_lines"("batch_id");
CREATE INDEX IF NOT EXISTS "movement_lines_container_id_idx" ON "movement_lines"("container_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movement_lines_movement_id_fkey'
  ) THEN
    ALTER TABLE "movement_lines"
      ADD CONSTRAINT "movement_lines_movement_id_fkey"
      FOREIGN KEY ("movement_id") REFERENCES "movements"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movement_lines_product_id_fkey'
  ) THEN
    ALTER TABLE "movement_lines"
      ADD CONSTRAINT "movement_lines_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movement_lines_batch_id_fkey'
  ) THEN
    ALTER TABLE "movement_lines"
      ADD CONSTRAINT "movement_lines_batch_id_fkey"
      FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movement_lines_container_id_fkey'
  ) THEN
    ALTER TABLE "movement_lines"
      ADD CONSTRAINT "movement_lines_container_id_fkey"
      FOREIGN KEY ("container_id") REFERENCES "containers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
