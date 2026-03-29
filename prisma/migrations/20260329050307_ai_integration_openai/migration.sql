-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('REPORT', 'EXPIRY_RISK', 'FORECAST');

-- DropIndex
DROP INDEX "audit_events_actor_user_id_created_at_desc_idx";

-- DropIndex
DROP INDEX "audit_events_created_at_desc_idx";

-- DropIndex
DROP INDEX "audit_events_entity_type_entity_id_created_at_desc_idx";

-- DropIndex
DROP INDEX "containers_is_sealed_idx";

-- DropIndex
DROP INDEX "cycle_count_lines_cycle_count_id_created_at_idx";

-- DropIndex
DROP INDEX "cycle_counts_created_at_desc_idx";

-- DropIndex
DROP INDEX "cycle_counts_location_id_created_at_desc_idx";

-- DropIndex
DROP INDEX "cycle_counts_status_created_at_desc_idx";

-- DropIndex
ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_route_key_actor_user_id_key";

-- DropIndex
DROP INDEX "issues_created_at_idx";

-- DropIndex
DROP INDEX "movements_created_at_idx";

-- DropIndex
DROP INDEX "movements_from_location_id_created_at_idx";

-- DropIndex
DROP INDEX "movements_to_location_id_created_at_idx";

-- DropIndex
DROP INDEX "pick_tasks_status_created_at_idx";

-- DropIndex
DROP INDEX "receipts_created_at_idx";

-- DropIndex
DROP INDEX "receipts_supplier_id_created_at_idx";

-- DropIndex
DROP INDEX "receipts_warehouse_id_created_at_idx";

-- AlterTable
ALTER TABLE "app_timeout_config" ALTER COLUMN "id" SET DEFAULT 'default';

-- CreateTable
CREATE TABLE "ai_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "filter_json" JSONB NOT NULL,
    "result_markdown" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "token_usage" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_histories_user_id_created_at_idx" ON "ai_histories"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_histories" ADD CONSTRAINT "ai_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "batches_product_id_supplier_id_manufacture_date_expiry_date_lot" RENAME TO "batches_product_id_supplier_id_manufacture_date_expiry_date_key";
