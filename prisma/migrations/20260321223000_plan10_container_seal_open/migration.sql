-- Plan 10 - Container seal/open-seal
ALTER TABLE "containers"
ADD COLUMN "is_sealed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sealed_at" TIMESTAMP(3),
ADD COLUMN "sealed_by" UUID;

ALTER TABLE "containers"
ADD CONSTRAINT "containers_sealed_by_fkey"
FOREIGN KEY ("sealed_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "containers_is_sealed_idx" ON "containers"("is_sealed");
