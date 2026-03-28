CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" UUID NOT NULL,
  "document_type" TEXT NOT NULL,
  "document_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "po_code" TEXT,
  "threshold_snapshot" JSONB NOT NULL,
  "requested_by" UUID NOT NULL,
  "decided_by" UUID,
  "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_requests_document_type_document_id_key"
  ON "approval_requests"("document_type", "document_id");

CREATE INDEX IF NOT EXISTS "approval_requests_status_created_at_idx"
  ON "approval_requests"("status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'approval_requests_requested_by_fkey'
  ) THEN
    ALTER TABLE "approval_requests"
      ADD CONSTRAINT "approval_requests_requested_by_fkey"
      FOREIGN KEY ("requested_by")
      REFERENCES "users"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'approval_requests_decided_by_fkey'
  ) THEN
    ALTER TABLE "approval_requests"
      ADD CONSTRAINT "approval_requests_decided_by_fkey"
      FOREIGN KEY ("decided_by")
      REFERENCES "users"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;
