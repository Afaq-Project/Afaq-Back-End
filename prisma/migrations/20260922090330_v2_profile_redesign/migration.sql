/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `doc_type` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `is_encrypted` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `label_ar` on the `education_levels` table. All the data in the column will be lost.
  - You are about to drop the column `label_en` on the `education_levels` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `education_levels` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `languages_master` table. All the data in the column will be lost.
  - You are about to drop the column `notif_type` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `degree` on the `user_educations` table. All the data in the column will be lost.
  - You are about to drop the column `gpa_normalized_4` on the `user_educations` table. All the data in the column will be lost.
  - You are about to drop the column `gpa_raw_scale` on the `user_educations` table. All the data in the column will be lost.
  - You are about to drop the column `graduation_year` on the `user_educations` table. All the data in the column will be lost.
  - You are about to drop the column `institution` on the `user_educations` table. All the data in the column will be lost.
  - You are about to drop the column `major` on the `user_educations` table. All the data in the column will be lost.
  - You are about to drop the column `proficiency` on the `user_languages` table. All the data in the column will be lost.
  - You are about to drop the column `career_goals` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `current_city` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `current_country` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `experience_level` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `field_of_study` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `full_name` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `has_financial_need` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `is_draft` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `nationality` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `preferences` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `published_at` on the `user_profiles` table. All the data in the column will be lost.
  - You are about to drop the `application_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `application_status_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `applications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fields_of_study` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `opportunities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reminders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `skills_master` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_skills` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[code]` on the table `education_levels` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name_en]` on the table `languages_master` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[iso_code]` on the table `languages_master` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,institution_id,major_id,education_level_id]` on the table `user_educations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `document_type_id` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `education_levels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_ar` to the `education_levels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_en` to the `education_levels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_ar` to the `languages_master` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_en` to the `languages_master` table without a default value. This is not possible if the table is not empty.
  - Added the required column `notification_type_id` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `education_level_id` to the `user_educations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `institution_id` to the `user_educations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `major_id` to the `user_educations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `proficiency_level_id` to the `user_languages` table without a default value. This is not possible if the table is not empty.
  - Made the column `first_name` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `last_name` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "GpaScale" AS ENUM ('OUT_OF_100', 'OUT_OF_5', 'OUT_OF_4');

-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_application_id_fkey";

-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_document_id_fkey";

-- DropForeignKey
ALTER TABLE "application_status_history" DROP CONSTRAINT "application_status_history_application_id_fkey";

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_opportunity_id_fkey";

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_application_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_opportunities" DROP CONSTRAINT "saved_opportunities_opportunity_id_fkey";

-- DropForeignKey
ALTER TABLE "user_educations" DROP CONSTRAINT "user_educations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_languages" DROP CONSTRAINT "user_languages_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_skills" DROP CONSTRAINT "user_skills_skill_id_fkey";

-- DropForeignKey
ALTER TABLE "user_skills" DROP CONSTRAINT "user_skills_user_id_fkey";

-- DropIndex
DROP INDEX "education_levels_name_key";

-- DropIndex
DROP INDEX "languages_master_name_key";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "deleted_at",
DROP COLUMN "doc_type",
DROP COLUMN "is_encrypted",
ADD COLUMN     "document_type_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "education_levels" DROP COLUMN "label_ar",
DROP COLUMN "label_en",
DROP COLUMN "name",
ADD COLUMN     "code" VARCHAR(50) NOT NULL,
ADD COLUMN     "name_ar" VARCHAR(100) NOT NULL,
ADD COLUMN     "name_en" VARCHAR(100) NOT NULL,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "languages_master" DROP COLUMN "name",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "iso_code" VARCHAR(5),
ADD COLUMN     "name_ar" VARCHAR(100) NOT NULL,
ADD COLUMN     "name_en" VARCHAR(100) NOT NULL,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "notif_type",
ADD COLUMN     "notification_type_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "saved_opportunities" ADD COLUMN     "external_source" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "user_educations" DROP COLUMN "degree",
DROP COLUMN "gpa_normalized_4",
DROP COLUMN "gpa_raw_scale",
DROP COLUMN "graduation_year",
DROP COLUMN "institution",
DROP COLUMN "major",
ADD COLUMN     "education_level_id" UUID NOT NULL,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "expected_graduation_date" DATE,
ADD COLUMN     "gpa_normalized" DECIMAL(5,2),
ADD COLUMN     "gpa_scale" "GpaScale",
ADD COLUMN     "institution_id" UUID NOT NULL,
ADD COLUMN     "is_current" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "major_id" UUID NOT NULL,
ADD COLUMN     "minor_major_id" UUID,
ADD COLUMN     "start_date" DATE;

-- AlterTable
ALTER TABLE "user_languages" DROP COLUMN "proficiency",
ADD COLUMN     "is_native" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proficiency_level_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "user_profiles" DROP COLUMN "career_goals",
DROP COLUMN "current_city",
DROP COLUMN "current_country",
DROP COLUMN "experience_level",
DROP COLUMN "field_of_study",
DROP COLUMN "full_name",
DROP COLUMN "has_financial_need",
DROP COLUMN "is_draft",
DROP COLUMN "nationality",
DROP COLUMN "preferences",
DROP COLUMN "published_at",
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "country_of_residence_id" UUID,
ADD COLUMN     "current_city_id" UUID,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "first_name" VARCHAR(255),
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "is_matchable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_name" VARCHAR(255),
ADD COLUMN     "marital_status_id" UUID,
ADD COLUMN     "nationality_id" UUID;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "first_name" SET NOT NULL,
ALTER COLUMN "last_name" SET NOT NULL;

-- DropTable
DROP TABLE "application_documents";

-- DropTable
DROP TABLE "application_status_history";

-- DropTable
DROP TABLE "applications";

-- DropTable
DROP TABLE "fields_of_study";

-- DropTable
DROP TABLE "opportunities";

-- DropTable
DROP TABLE "reminders";

-- DropTable
DROP TABLE "skills_master";

-- DropTable
DROP TABLE "user_skills";

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "nationality_name_en" VARCHAR(100),
    "nationality_name_ar" VARCHAR(100),
    "iso_code" VARCHAR(3),
    "iso_code2" VARCHAR(2),
    "region_en" VARCHAR(100),
    "region_ar" VARCHAR(100),
    "phone_code" VARCHAR(10),
    "flag_emoji" VARCHAR(10),
    "external_source_id" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(150) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "country_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(255) NOT NULL,
    "name_ar" VARCHAR(255) NOT NULL,
    "short_name_en" VARCHAR(100),
    "short_name_ar" VARCHAR(100),
    "country_id" UUID,
    "city_id" UUID,
    "type" VARCHAR(50),
    "website_url" TEXT,
    "logo_url" TEXT,
    "external_source_id" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "major_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(150) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "major_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "majors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(255) NOT NULL,
    "name_ar" VARCHAR(255) NOT NULL,
    "category_id" UUID,
    "external_source_id" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "majors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marital_statuses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(50) NOT NULL,
    "name_ar" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "marital_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_statuses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "special_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standardized_tests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "min_score" DECIMAL(6,2) NOT NULL,
    "max_score" DECIMAL(6,2) NOT NULL,
    "score_step" DECIMAL(4,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "standardized_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proficiency_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(50) NOT NULL,
    "name_ar" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "proficiency_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_en" VARCHAR(50) NOT NULL,
    "name_ar" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "notification_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "user_special_statuses" (
    "user_id" UUID NOT NULL,
    "special_status_id" UUID NOT NULL,

    CONSTRAINT "user_special_statuses_pkey" PRIMARY KEY ("user_id","special_status_id")
);

-- CreateTable
CREATE TABLE "user_target_degrees" (
    "user_id" UUID NOT NULL,
    "education_level_id" UUID NOT NULL,

    CONSTRAINT "user_target_degrees_pkey" PRIMARY KEY ("user_id","education_level_id")
);

-- CreateTable
CREATE TABLE "user_target_majors" (
    "user_id" UUID NOT NULL,
    "major_id" UUID NOT NULL,

    CONSTRAINT "user_target_majors_pkey" PRIMARY KEY ("user_id","major_id")
);

-- CreateTable
CREATE TABLE "user_target_institutions" (
    "user_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,

    CONSTRAINT "user_target_institutions_pkey" PRIMARY KEY ("user_id","institution_id")
);

-- CreateTable
CREATE TABLE "user_test_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "score" DECIMAL(6,2) NOT NULL,
    "test_date" DATE,

    CONSTRAINT "user_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_code_key" ON "countries"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_code2_key" ON "countries"("iso_code2");

-- CreateIndex
CREATE UNIQUE INDEX "countries_external_source_id_key" ON "countries"("external_source_id");

-- CreateIndex
CREATE INDEX "countries_name_en_idx" ON "countries"("name_en");

-- CreateIndex
CREATE INDEX "cities_country_id_idx" ON "cities"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_external_source_id_key" ON "institutions"("external_source_id");

-- CreateIndex
CREATE INDEX "institutions_country_id_idx" ON "institutions"("country_id");

-- CreateIndex
CREATE INDEX "institutions_city_id_idx" ON "institutions"("city_id");

-- CreateIndex
CREATE INDEX "institutions_type_idx" ON "institutions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "major_categories_name_en_key" ON "major_categories"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "majors_external_source_id_key" ON "majors"("external_source_id");

-- CreateIndex
CREATE INDEX "majors_category_id_idx" ON "majors"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "marital_statuses_name_en_key" ON "marital_statuses"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "special_statuses_name_en_key" ON "special_statuses"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "standardized_tests_name_en_key" ON "standardized_tests"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "proficiency_levels_name_en_key" ON "proficiency_levels"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_name_en_key" ON "document_types"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "notification_types_code_key" ON "notification_types"("code");

-- CreateIndex
CREATE INDEX "user_test_results_user_id_idx" ON "user_test_results"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_test_results_user_id_test_id_key" ON "user_test_results"("user_id", "test_id");

-- CreateIndex
CREATE INDEX "change_log_changed_at_idx" ON "change_log"("changed_at");

-- CreateIndex
CREATE INDEX "documents_document_type_id_idx" ON "documents"("document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "education_levels_code_key" ON "education_levels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "languages_master_name_en_key" ON "languages_master"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "languages_master_iso_code_key" ON "languages_master"("iso_code");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "saved_opportunities_user_id_saved_at_idx" ON "saved_opportunities"("user_id", "saved_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_educations_user_id_institution_id_major_id_education_l_key" ON "user_educations"("user_id", "institution_id", "major_id", "education_level_id");

-- CreateIndex
CREATE INDEX "user_languages_proficiency_level_id_idx" ON "user_languages"("proficiency_level_id");

-- CreateIndex
CREATE INDEX "user_profiles_is_matchable_idx" ON "user_profiles"("is_matchable");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_country_of_residence_id_fkey" FOREIGN KEY ("country_of_residence_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_nationality_id_fkey" FOREIGN KEY ("nationality_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_current_city_id_fkey" FOREIGN KEY ("current_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_marital_status_id_fkey" FOREIGN KEY ("marital_status_id") REFERENCES "marital_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "majors" ADD CONSTRAINT "majors_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "major_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_special_statuses" ADD CONSTRAINT "user_special_statuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_special_statuses" ADD CONSTRAINT "user_special_statuses_special_status_id_fkey" FOREIGN KEY ("special_status_id") REFERENCES "special_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_target_degrees" ADD CONSTRAINT "user_target_degrees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_target_degrees" ADD CONSTRAINT "user_target_degrees_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_target_majors" ADD CONSTRAINT "user_target_majors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_target_majors" ADD CONSTRAINT "user_target_majors_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_target_institutions" ADD CONSTRAINT "user_target_institutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_target_institutions" ADD CONSTRAINT "user_target_institutions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_educations" ADD CONSTRAINT "user_educations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_educations" ADD CONSTRAINT "user_educations_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_educations" ADD CONSTRAINT "user_educations_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_educations" ADD CONSTRAINT "user_educations_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_educations" ADD CONSTRAINT "user_educations_minor_major_id_fkey" FOREIGN KEY ("minor_major_id") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_languages" ADD CONSTRAINT "user_languages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_languages" ADD CONSTRAINT "user_languages_proficiency_level_id_fkey" FOREIGN KEY ("proficiency_level_id") REFERENCES "proficiency_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_test_results" ADD CONSTRAINT "user_test_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_test_results" ADD CONSTRAINT "user_test_results_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "standardized_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_notification_type_id_fkey" FOREIGN KEY ("notification_type_id") REFERENCES "notification_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
