-- AlterTable
ALTER TABLE "Session" ADD COLUMN "notes" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nameKey" TEXT NOT NULL,
    "activeKey" TEXT,
    CONSTRAINT "Program_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Program" ("activeKey", "createdAt", "id", "isActive", "name", "nameKey", "ownerId") SELECT "activeKey", "createdAt", "id", "isActive", "name", "nameKey", "ownerId" FROM "Program";
DROP TABLE "Program";
ALTER TABLE "new_Program" RENAME TO "Program";
CREATE INDEX "Program_ownerId_idx" ON "Program"("ownerId");
CREATE UNIQUE INDEX "Program_ownerId_nameKey_key" ON "Program"("ownerId", "nameKey");
CREATE UNIQUE INDEX "Program_ownerId_activeKey_key" ON "Program"("ownerId", "activeKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
