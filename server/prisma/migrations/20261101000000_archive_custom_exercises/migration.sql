ALTER TABLE "Exercise"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Exercise_ownerId_archivedAt_idx" ON "Exercise"("ownerId", "archivedAt");
