CREATE TYPE "WeightUnit" AS ENUM ('KG', 'LB');

ALTER TABLE "User"
  ADD COLUMN "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG';
