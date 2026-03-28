-- Plan 09 - Picking/Issue core + FEFO suggestion
CREATE TABLE "issues" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "issues_code_key" ON "issues"("code");
CREATE INDEX "issues_status_created_at_idx" ON "issues"("status", "created_at");

CREATE TABLE "issue_lines" (
  "id" UUID NOT NULL,
  "issue_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "quantity_base" DECIMAL(18, 6) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "issue_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "issue_lines_issue_id_idx" ON "issue_lines"("issue_id");
CREATE INDEX "issue_lines_product_id_idx" ON "issue_lines"("product_id");

CREATE TABLE "pick_tasks" (
  "id" UUID NOT NULL,
  "issue_line_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "container_id" UUID,
  "reservation_id" UUID,
  "quantity_base" DECIMAL(18, 6) NOT NULL,
  "picked_quantity" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pick_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pick_tasks_reservation_id_key" ON "pick_tasks"("reservation_id");
CREATE INDEX "pick_tasks_issue_line_id_idx" ON "pick_tasks"("issue_line_id");
CREATE INDEX "pick_tasks_product_id_batch_id_location_id_container_id_idx"
ON "pick_tasks"("product_id", "batch_id", "location_id", "container_id");
CREATE INDEX "pick_tasks_status_idx" ON "pick_tasks"("status");

ALTER TABLE "issues"
ADD CONSTRAINT "issues_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "issue_lines"
ADD CONSTRAINT "issue_lines_issue_id_fkey"
FOREIGN KEY ("issue_id") REFERENCES "issues"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "issue_lines"
ADD CONSTRAINT "issue_lines_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pick_tasks"
ADD CONSTRAINT "pick_tasks_issue_line_id_fkey"
FOREIGN KEY ("issue_line_id") REFERENCES "issue_lines"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pick_tasks"
ADD CONSTRAINT "pick_tasks_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pick_tasks"
ADD CONSTRAINT "pick_tasks_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pick_tasks"
ADD CONSTRAINT "pick_tasks_location_id_fkey"
FOREIGN KEY ("location_id") REFERENCES "locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pick_tasks"
ADD CONSTRAINT "pick_tasks_container_id_fkey"
FOREIGN KEY ("container_id") REFERENCES "containers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pick_tasks"
ADD CONSTRAINT "pick_tasks_reservation_id_fkey"
FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
