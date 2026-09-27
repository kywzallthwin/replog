-- W2-13: category migration. Take a database backup before applying outside local/test.
ALTER TYPE "ExerciseCategory" RENAME TO "ExerciseCategoryLegacy";
CREATE TABLE "ExerciseCategory" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "ownerId" TEXT,
    "builtInKey" TEXT,
    "displayOrder" INTEGER NOT NULL,
    CONSTRAINT "ExerciseCategory_pkey" PRIMARY KEY ("id")
);
INSERT INTO "ExerciseCategory" ("id", "displayName", "normalizedName", "builtInKey", "displayOrder") VALUES
 ('category-chest','Chest','chest','CHEST',1),('category-back','Back','back','BACK',2),
 ('category-shoulders','Shoulders','shoulders','SHOULDERS',3),('category-core','Core','core','CORE',4),
 ('category-biceps','Biceps','biceps','BICEPS',5),('category-triceps','Triceps','triceps','TRICEPS',6),
 ('category-forearms','Forearms','forearms','FOREARMS',7),('category-quads','Quads','quads','QUADS',8),
 ('category-hamstrings','Hamstrings','hamstrings','HAMSTRINGS',9),('category-glutes','Glutes','glutes','GLUTES',10),
 ('category-calves','Calves','calves','CALVES',11),('category-other','Other','other','OTHER',12);
ALTER TABLE "Exercise" ADD COLUMN "categoryId" TEXT;
UPDATE "Exercise" e SET "categoryId" = CASE
 WHEN e."name" IN ('Barbell Curl','Hammer Curl') THEN 'category-biceps'
 WHEN e."name" = 'Triceps Pushdown' THEN 'category-triceps'
 WHEN e."name" IN ('Squat','Leg Press') THEN 'category-quads'
 WHEN e."name" = 'Romanian Deadlift' THEN 'category-hamstrings'
 WHEN e."category"::text = 'CHEST' THEN 'category-chest'
 WHEN e."category"::text = 'BACK' THEN 'category-back'
 WHEN e."category"::text = 'SHOULDERS' THEN 'category-shoulders'
 WHEN e."category"::text = 'CORE' THEN 'category-core'
 ELSE 'category-other' END;
ALTER TABLE "Exercise" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExerciseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Exercise" DROP COLUMN "category";
DROP TYPE "ExerciseCategoryLegacy";
ALTER TABLE "ExerciseCategory" ADD CONSTRAINT "ExerciseCategory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ExerciseCategory_builtInKey_key" ON "ExerciseCategory"("builtInKey");
CREATE UNIQUE INDEX "ExerciseCategory_owner_normalized_visible_key" ON "ExerciseCategory"("ownerId", "normalizedName");
CREATE INDEX "ExerciseCategory_ownerId_displayOrder_idx" ON "ExerciseCategory"("ownerId", "displayOrder");
CREATE INDEX "Exercise_categoryId_idx" ON "Exercise"("categoryId");
