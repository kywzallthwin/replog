-- Existing unfinished sessions are retained as completed sessions, except for
-- the newest unfinished session for each user, which remains active.
UPDATE "Session"
SET
    "endedAt" = "startedAt",
    "durationSec" = 0
WHERE "endedAt" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "Session" AS newer
    WHERE newer."userId" = "Session"."userId"
      AND newer."endedAt" IS NULL
      AND (
        newer."startedAt" > "Session"."startedAt"
        OR (
          newer."startedAt" = "Session"."startedAt"
          AND newer."id" > "Session"."id"
        )
      )
  );

CREATE UNIQUE INDEX "Session_one_active_per_user"
ON "Session"("userId")
WHERE "endedAt" IS NULL;
