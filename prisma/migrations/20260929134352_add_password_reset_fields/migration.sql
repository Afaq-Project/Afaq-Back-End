-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_reset_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_reset_required_at" TIMESTAMPTZ(6);
