ALTER TABLE "Program" ADD COLUMN "activeKey" TEXT;

UPDATE "Program"
SET "activeKey" = CASE WHEN "isActive" = 1 THEN 'active' ELSE NULL END;

DROP INDEX IF EXISTS "Program_one_active_per_user";

CREATE UNIQUE INDEX "Program_ownerId_activeKey_key"
ON "Program"("ownerId", "activeKey");

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programId" TEXT,
    "programNameSnapshot" TEXT,
    "dayId" TEXT,
    "dayNameSnapshot" TEXT NOT NULL,
    "badgeColorSnapshot" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "durationSec" INTEGER,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Session_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Session" ("id", "userId", "programId", "programNameSnapshot", "dayId", "dayNameSnapshot", "badgeColorSnapshot", "startedAt", "endedAt", "durationSec")
SELECT "id", "userId", "programId", "programNameSnapshot", "dayId", "dayNameSnapshot", "badgeColorSnapshot", "startedAt", "endedAt", "durationSec"
FROM "Session";

DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";

CREATE INDEX "Session_dayId_idx" ON "Session"("dayId");
CREATE INDEX "Session_programId_idx" ON "Session"("programId");
CREATE INDEX "Session_userId_startedAt_idx" ON "Session"("userId", "startedAt");
CREATE UNIQUE INDEX "Session_one_active_per_user"
ON "Session"("userId")
WHERE "endedAt" IS NULL;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
