-- Plan 07 - Reservation & Locking engine
CREATE TABLE "reservations" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "container_id" UUID,
  "quantity_base" DECIMAL(18, 6) NOT NULL,
  "status" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "last_activity_at" TIMESTAMP(3) NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reservations_product_id_batch_id_location_id_container_id_idx"
ON "reservations"("product_id", "batch_id", "location_id", "container_id");

CREATE INDEX "reservations_status_idx"
ON "reservations"("status");

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_location_id_fkey"
FOREIGN KEY ("location_id") REFERENCES "locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_container_id_fkey"
FOREIGN KEY ("container_id") REFERENCES "containers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
