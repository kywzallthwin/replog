-- Add optional form feedback without changing existing set history.
ALTER TABLE "SetLog" ADD COLUMN "formQuality" TEXT;
ALTER TABLE "SetLog" ADD COLUMN "notes" TEXT;
