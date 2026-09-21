# Profile Feature: Database Schema Design Report

This report outlines the tables, relationships, and the generated Prisma schema code required to implement the enhanced profile features (Spec 004).

## 1. Complete List of Tables

### Modified Existing Tables
1.  `Users` (Core auth user, unmodified)
2.  `UserProfiles` (Added Gender Enum, removed strings, added Foreign Keys)
3.  `UserEducations` (Removed string institution/major, added Foreign Keys, updated GPA)
4.  `UserLanguages` (Added `isNative` boolean flag)
5.  `EducationLevel` (Unmodified, used for target degrees)

### New Master Data Tables (Cached / External Source)
6.  `Countries` (Used for both Residence and Nationality)
7.  `Institutions` (Universities and Institutes)
8.  `Majors` (Fields of Study)

### New Master Data Tables (Static / Internal)
9.  `MaritalStatuses`
10. `SpecialStatuses`
11. `StandardizedTests` (Includes validation limits: min, max, step)

### New Pivot / Linking Tables (Many-to-Many)
12. `UserSpecialStatuses` (User ↔ Special Statuses)
13. `UserPrefTargetDegrees` (User ↔ Target Education Levels)
14. `UserPrefTargetMajors` (User ↔ Target Majors)
15. `UserPrefInstitutions` (User ↔ Desired Institutions)
16. `UserTestResults` (User ↔ Standardized Tests + Score data)

---

## 2. Table Relationships

*   **1-to-1 / 1-to-Many Relationships (Foreign Keys directly in Profile/Education):**
    *   `UserProfiles.nationalityId` → `Countries.id`
    *   `UserProfiles.countryOfResidenceId` → `Countries.id`
    *   `UserProfiles.maritalStatusId` → `MaritalStatuses.id`
    *   `UserEducations.institutionId` → `Institutions.id`
    *   `UserEducations.majorId` → `Majors.id`

*   **Many-to-Many Relationships (Pivot Tables):**
    *   `UserProfiles` ↔ (`UserSpecialStatuses`) ↔ `SpecialStatuses`
    *   `UserProfiles` ↔ (`UserPrefTargetDegrees`) ↔ `EducationLevel`
    *   `UserProfiles` ↔ (`UserPrefTargetMajors`) ↔ `Majors`
    *   `UserProfiles` ↔ (`UserPrefInstitutions`) ↔ `Institutions`
    *   `Users` ↔ (`UserTestResults`) ↔ `StandardizedTests`

---

## 3. Prisma Schema Implementation

Below is the code snippet containing the Enums, the Master Tables, the Pivot Tables, and the updated `UserProfiles` / `UserEducations` models. You can insert these directly into your `schema.prisma`.

```prisma
// ============================================================
// Enums
// ============================================================

enum Gender {
  MALE
  FEMALE
}

enum GpaScale {
  OUT_OF_100
  OUT_OF_5
  OUT_OF_4
}

// ============================================================
// Modified Core Models
// ============================================================

model UserProfiles {
  userId               String    @id @map("user_id") @db.Uuid
  fullName             String?   @map("full_name") @db.Text
  dateOfBirth          DateTime? @map("date_of_birth") @db.Date
  gender               Gender?
  
  countryOfResidenceId String?   @map("country_of_residence_id") @db.Uuid
  nationalityId        String?   @map("nationality_id") @db.Uuid
  maritalStatusId      String?   @map("marital_status_id") @db.Uuid
  educationLevelId     String?   @map("education_level_id") @db.Uuid
  
  currentCity          String?   @map("current_city") @db.Text
  phone                String?   @db.Text
  experienceLevel      String?   @map("experience_level") @db.Text
  hasFinancialNeed     Boolean?  @map("has_financial_need")
  careerGoals          String?   @map("career_goals") @db.VarChar(500)
  profilePhotoUrl      String?   @map("profile_photo_url") @db.Text
  completionPct        Int       @default(0) @map("completion_pct")
  isDraft              Boolean   @default(true) @map("is_draft")
  publishedAt          DateTime? @map("published_at")
  matchingVersion      Int       @default(1) @map("matching_version")

  createdAt            DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime? @updatedAt @map("updated_at") @db.Timestamptz(6)

  // Direct Relations
  user                 Users            @relation(fields: [userId], references: [id], onDelete: Cascade)
  educationLevelRef    EducationLevel?  @relation(fields: [educationLevelId], references: [id])
  countryOfResidence   Countries?       @relation("ProfileResidence", fields: [countryOfResidenceId], references: [id])
  nationality          Countries?       @relation("ProfileNationality", fields: [nationalityId], references: [id])
  maritalStatus        MaritalStatuses? @relation(fields: [maritalStatusId], references: [id])

  // Pivot Relations (Many-to-Many)
  specialStatuses      UserSpecialStatuses[]
  targetDegrees        UserPrefTargetDegrees[]
  targetMajors         UserPrefTargetMajors[]
  targetInstitutions   UserPrefInstitutions[]

  @@index([matchingVersion])
  @@map("user_profiles")
}

model UserEducations {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String    @map("user_id") @db.Uuid
  degree            String    @db.Text
  
  institutionId     String    @map("institution_id") @db.Uuid
  majorId           String    @map("major_id") @db.Uuid
  
  graduationYear    Int?      @map("graduation_year")
  
  gpaRaw            Decimal?  @map("gpa_raw") @db.Decimal(5,2)
  gpaScale          GpaScale? @map("gpa_scale")
  gpaNormalized     Decimal?  @map("gpa_normalized") @db.Decimal(5,2)
  
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime? @updatedAt @map("updated_at") @db.Timestamptz(6)

  user              Users         @relation(fields: [userId], references: [id], onDelete: Cascade)
  institution       Institutions  @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  major             Majors        @relation(fields: [majorId], references: [id], onDelete: Restrict)

  @@index([userId, updatedAt])
  @@map("user_educations")
}

model UserLanguages {
  userId       String   @map("user_id") @db.Uuid
  languageId   String   @map("language_id") @db.Uuid
  proficiency  String   @db.Text
  isNative     Boolean  @default(false) @map("is_native")

  user         Users           @relation(fields: [userId], references: [id], onDelete: Cascade)
  language     LanguagesMaster @relation(fields: [languageId], references: [id], onDelete: Cascade)

  @@id([userId, languageId])
  @@map("user_languages")
}


// ============================================================
// Master Data Tables
// ============================================================

model Countries {
  id                 String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nameEn             String  @map("name_en") @db.VarChar(100)
  nameAr             String  @map("name_ar") @db.VarChar(100)
  nationalityNameEn  String? @map("nationality_name_en") @db.VarChar(100)
  nationalityNameAr  String? @map("nationality_name_ar") @db.VarChar(100)
  isoCode            String? @map("iso_code") @db.VarChar(3)
  externalSourceId   String? @map("external_source_id") @unique @db.VarChar(100)

  residentProfiles   UserProfiles[] @relation("ProfileResidence")
  nationalProfiles   UserProfiles[] @relation("ProfileNationality")
  institutions       Institutions[]
  
  @@map("countries")
}

model Institutions {
  id                 String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nameEn             String  @map("name_en") @db.VarChar(255)
  nameAr             String  @map("name_ar") @db.VarChar(255)
  countryId          String? @map("country_id") @db.Uuid
  externalSourceId   String? @map("external_source_id") @unique @db.VarChar(100)

  country            Countries? @relation(fields: [countryId], references: [id], onDelete: SetNull)
  userEducations     UserEducations[]
  targetedBy         UserPrefInstitutions[]
  
  @@map("institutions")
}

model Majors {
  id                 String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nameEn             String  @map("name_en") @db.VarChar(255)
  nameAr             String  @map("name_ar") @db.VarChar(255)
  categoryEn         String? @map("category_en") @db.VarChar(255)
  categoryAr         String? @map("category_ar") @db.VarChar(255)
  externalSourceId   String? @map("external_source_id") @unique @db.VarChar(100)

  userEducations     UserEducations[]
  targetedBy         UserPrefTargetMajors[]
  
  @@map("majors")
}

model MaritalStatuses {
  id       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nameEn   String  @map("name_en") @db.VarChar(50)
  nameAr   String  @map("name_ar") @db.VarChar(50)

  profiles UserProfiles[]
  @@map("marital_statuses")
}

model SpecialStatuses {
  id       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nameEn   String  @map("name_en") @db.VarChar(100)
  nameAr   String  @map("name_ar") @db.VarChar(100)

  users    UserSpecialStatuses[]
  @@map("special_statuses")
}

model StandardizedTests {
  id        String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nameEn    String  @map("name_en") @db.VarChar(100)
  nameAr    String  @map("name_ar") @db.VarChar(100)
  minScore  Decimal @map("min_score") @db.Decimal(5,2)
  maxScore  Decimal @map("max_score") @db.Decimal(5,2)
  scoreStep Decimal @map("score_step") @db.Decimal(4,2)

  results   UserTestResults[]
  @@map("standardized_tests")
}


// ============================================================
// Pivot Tables (Many-to-Many Relationships)
// ============================================================

model UserSpecialStatuses {
  userId           String @map("user_id") @db.Uuid
  specialStatusId  String @map("special_status_id") @db.Uuid

  user             UserProfiles     @relation(fields: [userId], references: [userId], onDelete: Cascade)
  status           SpecialStatuses  @relation(fields: [specialStatusId], references: [id], onDelete: Cascade)

  @@id([userId, specialStatusId])
  @@map("user_special_statuses")
}

model UserPrefTargetDegrees {
  userId           String @map("user_id") @db.Uuid
  educationLevelId String @map("education_level_id") @db.Uuid

  user             UserProfiles    @relation(fields: [userId], references: [userId], onDelete: Cascade)
  level            EducationLevel  @relation(fields: [educationLevelId], references: [id], onDelete: Cascade)

  @@id([userId, educationLevelId])
  @@map("user_pref_target_degrees")
}

model UserPrefTargetMajors {
  userId           String @map("user_id") @db.Uuid
  majorId          String @map("major_id") @db.Uuid

  user             UserProfiles @relation(fields: [userId], references: [userId], onDelete: Cascade)
  major            Majors       @relation(fields: [majorId], references: [id], onDelete: Cascade)

  @@id([userId, majorId])
  @@map("user_pref_target_majors")
}

model UserPrefInstitutions {
  userId           String @map("user_id") @db.Uuid
  institutionId    String @map("institution_id") @db.Uuid

  user             UserProfiles @relation(fields: [userId], references: [userId], onDelete: Cascade)
  institution      Institutions @relation(fields: [institutionId], references: [id], onDelete: Cascade)

  @@id([userId, institutionId])
  @@map("user_pref_institutions")
}

model UserTestResults {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId           String    @map("user_id") @db.Uuid
  testId           String    @map("test_id") @db.Uuid
  score            Decimal   @db.Decimal(5,2)
  testDate         DateTime? @map("test_date") @db.Date

  user             Users              @relation(fields: [userId], references: [id], onDelete: Cascade)
  test             StandardizedTests  @relation(fields: [testId], references: [id], onDelete: Cascade)

  @@map("user_test_results")
}
```
