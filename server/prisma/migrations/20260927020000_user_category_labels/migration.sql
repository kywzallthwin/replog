CREATE TABLE "UserCategoryLabel" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  CONSTRAINT "UserCategoryLabel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserCategoryLabel_userId_categoryId_key" UNIQUE ("userId", "categoryId"),
  CONSTRAINT "UserCategoryLabel_userId_normalizedName_key" UNIQUE ("userId", "normalizedName"),
  CONSTRAINT "UserCategoryLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserCategoryLabel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExerciseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UserCategoryLabel_categoryId_idx" ON "UserCategoryLabel"("categoryId");
