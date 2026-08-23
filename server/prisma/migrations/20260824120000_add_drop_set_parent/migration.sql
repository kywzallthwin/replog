ALTER TABLE "SetLog" ADD COLUMN "parentSetId" TEXT;

CREATE INDEX "SetLog_parentSetId_idx" ON "SetLog"("parentSetId");

PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SetLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionExerciseId" TEXT NOT NULL,
    "parentSetId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "weightKg" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "SetLog_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetLog_parentSetId_fkey" FOREIGN KEY ("parentSetId") REFERENCES "SetLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_SetLog" ("id", "sessionExerciseId", "parentSetId", "kind", "notes", "weightKg", "reps", "order")
SELECT "id", "sessionExerciseId", "parentSetId", "kind", "notes", "weightKg", "reps", "order"
FROM "SetLog";

DROP TABLE "SetLog";
ALTER TABLE "new_SetLog" RENAME TO "SetLog";
CREATE UNIQUE INDEX "SetLog_sessionExerciseId_order_key" ON "SetLog"("sessionExerciseId", "order");
CREATE INDEX "SetLog_parentSetId_idx" ON "SetLog"("parentSetId");
PRAGMA foreign_keys=ON;
