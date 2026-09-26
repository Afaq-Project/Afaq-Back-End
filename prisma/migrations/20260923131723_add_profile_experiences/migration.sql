-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "experiences" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "user_profiles" ALTER COLUMN "experiences" SET NOT NULL;
