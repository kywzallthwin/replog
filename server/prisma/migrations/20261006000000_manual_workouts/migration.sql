CREATE TYPE "SessionSource" AS ENUM ('LIVE', 'MANUAL');

ALTER TABLE "Session"
  ADD COLUMN "source" "SessionSource" NOT NULL DEFAULT 'LIVE',
  ADD COLUMN "workoutDate" DATE,
  ADD COLUMN "notes" TEXT;

DROP INDEX "Session_one_active_per_user";
CREATE UNIQUE INDEX "Session_one_active_per_user"
  ON "Session"("userId")
  WHERE "endedAt" IS NULL AND "source" = 'LIVE';
CREATE UNIQUE INDEX "Session_one_manual_draft_per_user"
  ON "Session"("userId")
  WHERE "endedAt" IS NULL AND "source" = 'MANUAL';
