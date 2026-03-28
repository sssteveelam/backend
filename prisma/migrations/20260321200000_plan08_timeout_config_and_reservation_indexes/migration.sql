-- Plan 08 - Timeout config + reservation indexes for worker queries
CREATE TABLE "app_timeout_config" (
  "id" TEXT NOT NULL,
  "soft_reserve_minutes" INTEGER NOT NULL,
  "hard_lock_minutes" INTEGER NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_timeout_config_pkey" PRIMARY KEY ("id")
);

INSERT INTO "app_timeout_config" ("id", "soft_reserve_minutes", "hard_lock_minutes", "updated_at")
VALUES ('default', 30, 60, CURRENT_TIMESTAMP);

CREATE INDEX "reservations_status_expires_at_idx"
ON "reservations"("status", "expires_at");

CREATE INDEX "reservations_status_last_activity_at_idx"
ON "reservations"("status", "last_activity_at");
