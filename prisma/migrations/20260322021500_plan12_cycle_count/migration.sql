CREATE TABLE "cycle_counts" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "location_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cycle_counts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cycle_count_lines" (
  "id" UUID NOT NULL,
  "cycle_count_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "container_id" UUID,
  "counted_quantity" DECIMAL(18,6) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cycle_count_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cycle_counts_code_key" ON "cycle_counts"("code");
CREATE INDEX "cycle_counts_status_created_at_idx" ON "cycle_counts"("status", "created_at");
CREATE INDEX "cycle_counts_location_id_idx" ON "cycle_counts"("location_id");
CREATE INDEX "cycle_count_lines_cycle_count_id_idx" ON "cycle_count_lines"("cycle_count_id");
CREATE INDEX "cycle_count_lines_product_id_batch_id_container_id_idx"
ON "cycle_count_lines"("product_id", "batch_id", "container_id");

ALTER TABLE "cycle_counts"
ADD CONSTRAINT "cycle_counts_location_id_fkey"
FOREIGN KEY ("location_id") REFERENCES "locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cycle_counts"
ADD CONSTRAINT "cycle_counts_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cycle_count_lines"
ADD CONSTRAINT "cycle_count_lines_cycle_count_id_fkey"
FOREIGN KEY ("cycle_count_id") REFERENCES "cycle_counts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cycle_count_lines"
ADD CONSTRAINT "cycle_count_lines_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cycle_count_lines"
ADD CONSTRAINT "cycle_count_lines_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cycle_count_lines"
ADD CONSTRAINT "cycle_count_lines_container_id_fkey"
FOREIGN KEY ("container_id") REFERENCES "containers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
