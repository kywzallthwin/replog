-- Preserve existing programs while adding normalized names for owner-scoped uniqueness.
ALTER TABLE "Program" ADD COLUMN "nameKey" TEXT NOT NULL DEFAULT '';

UPDATE "Program"
SET "nameKey" = lower(trim("name"));

CREATE UNIQUE INDEX "Program_ownerId_nameKey_key"
ON "Program"("ownerId", "nameKey");

CREATE UNIQUE INDEX "Program_one_active_per_user"
ON "Program"("ownerId")
WHERE "isActive" = 1;

ALTER TABLE "Session" ADD COLUMN "programId" TEXT;
ALTER TABLE "Session" ADD COLUMN "programNameSnapshot" TEXT;

CREATE INDEX "Session_programId_idx" ON "Session"("programId");
