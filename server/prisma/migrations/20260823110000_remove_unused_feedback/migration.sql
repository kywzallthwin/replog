-- Keep optional per-set text notes, but remove the retired workout-level note
-- and structured form-quality fields.
ALTER TABLE "Session" DROP COLUMN "notes";
ALTER TABLE "SetLog" DROP COLUMN "formQuality";
