# Implementation Plan: Profile Creation & Management (Backend)

**Feature ID:** 003
**Feature Name:** Profile Creation & Management
**Sprint:** 2
**Status:** Draft
**Created:** 2026-08-30
**Updated:** 2026-08-30

---

## 1. Technical Context

### 1.1 Technology Stack

| Layer             | Technology                   | Version      |
| ----------------- | ---------------------------- | ------------ |
| Backend Framework | NestJS                       | ^10.0.0      |
| Database ORM      | Prisma                       | ^5.0.0       |
| Database          | PostgreSQL                   | 15+          |
| File Storage      | AWS S3 or Local              | Configurable |
| File Encryption   | Node.js Crypto (AES-256-CBC) | Built-in     |
| Testing           | Jest                         | ^29.0.0      |
| API Documentation | Swagger/OpenAPI              | ^7.0.0       |

### 1.2 Architecture Patterns

| Pattern              | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| Modular Architecture | Profile module with controllers, services, DTOs, and utilities. |
| Strategy Pattern     | Storage service abstraction (S3 vs Local).                      |
| DTO Pattern          | Request/Response data transfer objects with validation.         |
| Repository Pattern   | Prisma for data access.                                         |
| Utility Functions    | GPA normalization in shared utils.                              |

### 1.3 Prerequisites

- Feature 001 (JWT Auth) complete.
- Prisma schema includes all Levora tables (v1.2).
- `@Public()` decorator available.
- ConfigModule configured.

---

## 2. Architecture Overview

### 2.1 Module Structure

```
src/
├── modules/
│   └── profile/
│       ├── controllers/
│       │   ├── profile.controller.ts          # GET /profile, PATCH /profile
│       │   ├── documents.controller.ts        # POST/GET/DELETE documents
│       │   └── reference.controller.ts        # GET /reference/fields-of-study, /skills-taxonomy
│       ├── services/
│       │   ├── profile.service.ts             # Profile CRUD, completion %, core fields
│       │   ├── documents.service.ts           # Upload, download, delete, encryption
│       │   └── reference.service.ts           # Reference data from DB
│       ├── dto/
│       │   ├── update-profile.dto.ts          # Partial update DTO with validation
│       │   ├── upload-document.dto.ts         # Document upload DTO
│       │   └── profile-response.dto.ts        # Response DTO with calculated fields
│       ├── interfaces/
│       │   └── storage.interface.ts           # StorageService contract
│       ├── storage/
│       │   ├── storage.service.ts             # Factory/strategy selector
│       │   ├── s3-storage.service.ts          # S3 implementation
│       │   └── local-storage.service.ts       # Local filesystem implementation
│       └── profile.module.ts
├── common/
│   └── utils/
│       └── gpa-normalizer.ts                  # GPA normalization utility
└── config/
    └── configuration.ts                       # Storage configuration
```

### 2.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Profile Module                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐  │
│  │ ProfileController│────▶│  ProfileService │────▶│      Prisma         │  │
│  │  GET /profile    │     │  - getProfile   │     │  (UserProfiles)     │  │
│  │  PATCH /profile  │     │  - updateProfile│     │                     │  │
│  └─────────────────┘     │  - calcCompletion│     └─────────────────────┘  │
│                          └─────────────────┘                              │
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐  │
│  │DocumentsController│───▶│DocumentsService │────▶│    StorageService   │  │
│  │  POST /documents │     │  - upload       │     │  (S3 or Local)      │  │
│  │  GET /documents  │     │  - download     │     │                     │  │
│  │  DELETE /documents│    │  - delete       │     └─────────────────────┘  │
│  └─────────────────┘     │  - encrypt/decrypt│                            │
│                          └─────────────────┘                              │
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐  │
│  │ReferenceController│───▶│ReferenceService │────▶│      Prisma         │  │
│  │  GET /fields     │     │  - getFields    │     │  (FieldOfStudy,     │  │
│  │  GET /skills     │     │  - getSkills    │     │   SkillsMaster)     │  │
│  └─────────────────┘     └─────────────────┘     └─────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Strategy

### 3.1 Phase 1: Database Setup & Reference Data (T3, T1, T2)

**Goal:** Add reference tables, seed data, and create module skeleton.

**Tasks:**

1. Add `FieldOfStudy` and `Skill` models to Prisma schema (or extend `SkillsMaster`).
2. Create seed script with initial fields of study and skills taxonomy.
3. Run migration and seed.
4. Scaffold `ProfileModule` with controllers and services.
5. Implement `ReferenceService` with `GET /reference/fields-of-study` and `GET /reference/skills-taxonomy`.

**Success Criteria:**

- Reference tables exist in database.
- Seed data populated.
- Reference endpoints return expected data.

### 3.2 Phase 2: Profile CRUD (T4, T5, T6, T7, T15, T16)

**Goal:** Implement profile retrieval and partial updates.

**Tasks:**

1. Implement `ProfileService.getProfile(userId)` returning profile with calculated fields.
2. Implement `ProfileService.updateProfile(userId, data)` with validation.
3. Add core fields validation and `coreFieldsComplete` calculation.
4. Implement `completionPct` calculation with weighted field list.
5. Add multi-value field handling (fieldOfStudy, skills, languages) with array replacement.
6. Implement `GET /profile` and `PATCH /profile` endpoints.

**Success Criteria:**

- Profile retrieval works for authenticated users.
- Partial updates apply correctly.
- Core fields validation works.
- Completion percentage calculated correctly.

### 3.3 Phase 3: GPA Normalization (T13, T14)

**Goal:** Implement GPA normalization utility and integrate with profile updates.

**Tasks:**

1. Create `src/common/utils/gpa-normalizer.ts` with:
   - `normalizeGPA(value, scale): number`
   - `validateGPARange(value, scale): boolean`
   - `parseLetterGrade(letter): number`
2. Write unit tests for all scenarios.
3. Integrate GPA normalization into `PATCH /profile` for the `gpa` field (within `UserEducations`).
4. Add scale validation and rejection of invalid ranges.

**Success Criteria:**

- All GPA scales convert correctly.
- Invalid values rejected with 400.
- Utility functions 100% unit tested.

### 3.4 Phase 4: Storage Service (T8)

**Goal:** Implement storage abstraction with S3 and Local providers.

**Tasks:**

1. Define `StorageService` interface.
2. Implement `S3StorageService` using AWS SDK.
3. Implement `LocalStorageService` using Node.js `fs`.
4. Create factory/strategy selector based on config.
5. Add configuration validation at startup.

**Success Criteria:**

- Storage service initialized based on `STORAGE_PROVIDER`.
- Both providers implement upload, download, delete, and signed URL methods.
- Configuration validation fails fast on misconfiguration.

### 3.5 Phase 5: Document Management (T9, T10, T11, T12)

**Goal:** Implement document upload, download, and delete with security.

**Tasks:**

1. Implement `DocumentsService` with encryption/decryption.
2. Add file validation (MIME via file-type, size, count).
3. Implement `POST /profile/documents` with multer.
4. Implement `GET /profile/documents/:id/download` with signed URL.
5. Implement `DELETE /profile/documents/:id` with file deletion.
6. Add ownership checks for all operations.

**Success Criteria:**

- Upload validates MIME via magic bytes.
- Files encrypted and stored outside web root.
- Signed URLs read-only with 5-minute expiration.
- Ownership enforced.

### 3.6 Phase 6: Testing & Documentation (T17, T18, T19, T20)

**Goal:** Ensure quality and provide documentation.

**Tasks:**

1. Write unit tests for `ProfileService` (≥80% coverage).
2. Write unit tests for GPA utility (100% coverage).
3. Write E2E tests for all profile endpoints.
4. Add Swagger decorators to all controllers.
5. Run lint, tests, and build checks.

**Success Criteria:**

- All tests pass.
- Coverage goals met.
- Swagger UI shows all endpoints.
- Build completes without errors.

---

## 4. API Design

### 4.1 GET /profile

**Request:**

```
GET /profile
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "userId": "uuid",
    "fullName": "John Doe",
    "dateOfBirth": "1995-03-15",
    "nationality": "US",
    "educationLevel": "bachelor",
    "fieldOfStudy": ["Computer Science", "Mathematics"],
    "currentCountry": "US",
    "currentCity": "New York",
    "phone": "+1234567890",
    "experienceLevel": "entry",
    "hasFinancialNeed": false,
    "careerGoals": "To pursue a PhD in AI",
    "profilePhotoUrl": null,
    "completionPct": 65,
    "coreFieldsComplete": true,
    "lastCompletedStep": 3,
    "gpaNormalized4": 3.7,
    "isDraft": false,
    "educations": [...],
    "skills": [{ "skillId": "uuid", "name": "Python", "proficiency": 4 }],
    "languages": [{ "languageId": "uuid", "name": "English", "proficiency": "fluent" }],
    "documents": [...],
    "createdAt": "2026-08-30T10:00:00.000Z",
    "updatedAt": "2026-08-30T10:00:00.000Z"
  },
  "timestamp": "2026-08-30T10:00:00.000Z"
}
```

### 4.2 PATCH /profile

**Request:**

```
PATCH /profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "educationLevel": "master",
  "fieldOfStudy": ["Data Science", "AI"],
  "nationality": "US"
}
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Profile updated successfully",
  "data": {
    "userId": "uuid",
    "completionPct": 70,
    "coreFieldsComplete": true,
    "updatedAt": "2026-08-30T10:00:00.000Z"
  },
  "timestamp": "2026-08-30T10:00:00.000Z"
}
```

### 4.3 POST /profile/documents

**Request:**

```
POST /profile/documents
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: [binary file]
docType: resume
```

**Response (201):**

```json
{
  "statusCode": 201,
  "message": "Document uploaded successfully",
  "data": {
    "id": "uuid",
    "docType": "resume",
    "displayName": "my_resume.pdf",
    "storagePath": "encrypted/path",
    "mimeType": "application/pdf",
    "sizeBytes": 245760,
    "createdAt": "2026-08-30T10:00:00.000Z"
  },
  "timestamp": "2026-08-30T10:00:00.000Z"
}
```

### 4.4 GET /profile/documents/:id/download

**Request:**

```
GET /profile/documents/:id/download
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Download URL generated successfully",
  "data": {
    "url": "https://s3.amazonaws.com/bucket/...?X-Amz-Expires=300...",
    "expiresAt": "2026-08-30T10:05:00.000Z"
  },
  "timestamp": "2026-08-30T10:00:00.000Z"
}
```

### 4.5 DELETE /profile/documents/:id

**Request:**

```
DELETE /profile/documents/:id
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Document deleted successfully",
  "data": null,
  "timestamp": "2026-08-30T10:00:00.000Z"
}
```

### 4.6 GET /reference/fields-of-study

**Request:**

```
GET /reference/fields-of-study
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Fields of study retrieved successfully",
  "data": [
    { "id": "uuid", "name": "Computer Science", "category": "STEM" },
    { "id": "uuid", "name": "Business Administration", "category": "Business" }
  ],
  "timestamp": "2026-08-30T10:00:00.000Z"
}
```

### 4.7 GET /reference/skills-taxonomy

**Request:**

```
GET /reference/skills-taxonomy
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Skills taxonomy retrieved successfully",
  "data": [
    {
      "category": "Tech",
      "skills": [
        { "id": "uuid", "name": "JavaScript" },
        { "id": "uuid", "name": "Python" }
      ]
    },
    {
      "category": "Business",
      "skills": [{ "id": "uuid", "name": "Project Management" }]
    }
  ],
  "timestamp": "2026-08-30T10:00:00.000Z"
}
```

---

## 5. Database Schema Updates

### 5.1 New Models

```prisma
model FieldOfStudy {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String   @unique @db.Text
  category  String?  @db.Text
  isActive  Boolean  @default(true) @map("is_active")

  @@map("fields_of_study")
}

// Extend existing SkillsMaster or create new Skill model
model Skill {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String   @unique @db.Citext
  category    String   @db.Text  // Tech, Business, Arts, Science, Engineering, Healthcare
  isActive    Boolean  @default(true) @map("is_active")

  userSkills  UserSkills[]

  @@map("skills")
}

// Note: SkillsMaster already exists. Option 1: Use it with category field.
// Option 2: Create a separate SkillCategory table.
// Recommendation: Add 'category' to SkillsMaster and seed with categories.
```

### 5.2 Seed Data

```typescript
// prisma/seed.ts additions

// Fields of Study
const fieldsOfStudy = [
  { name: 'Computer Science', category: 'STEM' },
  { name: 'Software Engineering', category: 'STEM' },
  { name: 'Data Science', category: 'STEM' },
  { name: 'Artificial Intelligence', category: 'STEM' },
  { name: 'Business Administration', category: 'Business' },
  { name: 'Finance', category: 'Business' },
  { name: 'Marketing', category: 'Business' },
  { name: 'Fine Arts', category: 'Arts' },
  { name: 'Graphic Design', category: 'Arts' },
  { name: 'Physics', category: 'Science' },
  { name: 'Chemistry', category: 'Science' },
  { name: 'Biology', category: 'Science' },
  { name: 'Mechanical Engineering', category: 'Engineering' },
  { name: 'Electrical Engineering', category: 'Engineering' },
  { name: 'Civil Engineering', category: 'Engineering' },
  { name: 'Nursing', category: 'Healthcare' },
  { name: 'Medicine', category: 'Healthcare' },
  { name: 'Public Health', category: 'Healthcare' },
];

// Skills with categories
const skills = [
  // Tech
  { name: 'JavaScript', category: 'Tech' },
  { name: 'TypeScript', category: 'Tech' },
  { name: 'Python', category: 'Tech' },
  { name: 'Java', category: 'Tech' },
  { name: 'C++', category: 'Tech' },
  { name: 'React', category: 'Tech' },
  { name: 'Node.js', category: 'Tech' },
  { name: 'AWS', category: 'Tech' },
  { name: 'Docker', category: 'Tech' },
  { name: 'Kubernetes', category: 'Tech' },
  { name: 'SQL', category: 'Tech' },
  { name: 'MongoDB', category: 'Tech' },
  { name: 'PostgreSQL', category: 'Tech' },
  // Business
  { name: 'Project Management', category: 'Business' },
  { name: 'Data Analysis', category: 'Business' },
  { name: 'Financial Modeling', category: 'Business' },
  { name: 'Marketing Strategy', category: 'Business' },
  { name: 'Business Development', category: 'Business' },
  // Arts
  { name: 'Illustration', category: 'Arts' },
  { name: 'Photography', category: 'Arts' },
  { name: 'Video Editing', category: 'Arts' },
  // Science
  { name: 'Research', category: 'Science' },
  { name: 'Statistical Analysis', category: 'Science' },
  // Engineering
  { name: 'AutoCAD', category: 'Engineering' },
  { name: 'MATLAB', category: 'Engineering' },
  // Healthcare
  { name: 'Patient Care', category: 'Healthcare' },
  { name: 'Medical Research', category: 'Healthcare' },
];
```

---

## 6. Configuration

### 6.1 Environment Variables (.env.example)

```env
# Storage Configuration
STORAGE_PROVIDER="local"  # 'local' or 's3'

# Local Storage
LOCAL_UPLOAD_PATH="./uploads"

# S3 Storage (if STORAGE_PROVIDER=s3)
S3_REGION="us-east-1"
S3_BUCKET="levora-documents"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_ENDPOINT=""  # Optional: custom endpoint for MinIO

# File Encryption (generate with: node -e "console.log(crypto.randomBytes(32).toString('hex'))")
FILE_ENCRYPTION_KEY="a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890"

# Document Limits
MAX_FILE_SIZE_MB=5
MAX_DOCUMENTS_PER_USER=20
SIGNED_URL_EXPIRES_SECONDS=300
```

### 6.2 Configuration Module

```typescript
// config/configuration.ts
export default () => ({
  // ... existing config
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    local: {
      uploadPath: process.env.LOCAL_UPLOAD_PATH || './uploads',
    },
    s3: {
      region: process.env.S3_REGION,
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
      endpoint: process.env.S3_ENDPOINT || undefined,
    },
    encryption: {
      key: process.env.FILE_ENCRYPTION_KEY,
    },
    limits: {
      maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
      maxDocuments: parseInt(process.env.MAX_DOCUMENTS_PER_USER, 10) || 20,
      signedUrlExpires:
        parseInt(process.env.SIGNED_URL_EXPIRES_SECONDS, 10) || 300,
    },
  },
});
```

---

## 7. Security Considerations

| Concern                   | Implementation                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Malicious File Upload** | Validate MIME type via file signature (magic bytes) using `file-type`. Reject if signature doesn't match extension. |
| **Code Injection**        | Store files outside web root. Never execute uploaded files. Rename to UUID. Encrypt content.                        |
| **Unauthorized Access**   | All endpoints protected by JWT. Ownership checks on all document operations. RLS at database level.                 |
| **Signed URL Leakage**    | Short expiration (5 min). Read-only permissions. Requires authentication to generate.                               |
| **Encryption Key**        | Stored in environment variable, never in code. Validated at startup.                                                |
| **Path Traversal**        | Use UUID for storage paths. Never use user-provided filenames for storage.                                          |

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Test Suite                  | Target                               | Coverage |
| --------------------------- | ------------------------------------ | -------- |
| `gpa-normalizer.spec.ts`    | All normalization scenarios          | 100%     |
| `profile.service.spec.ts`   | CRUD, validation, completion %       | ≥80%     |
| `documents.service.spec.ts` | Upload, download, delete, encryption | ≥80%     |
| `reference.service.spec.ts` | Reference data retrieval             | ≥80%     |

### 8.2 E2E Tests

| Test Suite              | Endpoints Tested                   |
| ----------------------- | ---------------------------------- |
| `profile.e2e-spec.ts`   | GET /profile, PATCH /profile       |
| `documents.e2e-spec.ts` | POST/GET/DELETE /profile/documents |
| `reference.e2e-spec.ts` | GET /reference/*                   |

---

## 9. Quality Gates

| Gate   | Check                                 | Pass/Fail |
| ------ | ------------------------------------- | --------- |
| Gate 1 | `pnpm lint` passes with no errors     | [ ]       |
| Gate 2 | `pnpm test` passes with ≥80% coverage | [ ]       |
| Gate 3 | `pnpm build` completes successfully   | [ ]       |
| Gate 4 | GPA utility 100% unit tested          | [ ]       |
| Gate 5 | Swagger UI shows all endpoints        | [ ]       |
| Gate 6 | Document upload with encryption works | [ ]       |
| Gate 7 | Signed URL generation works           | [ ]       |
| Gate 8 | Ownership checks enforce isolation    | [ ]       |
| Gate 9 | Reference data seeded correctly       | [ ]       |

---

## 10. References

- [Feature Specification: Profile Module](./spec.md)
- [Levora Database Design v1.2](../database/Levora_Database_Design_v1.2_MVP.md)
- [Sprint 2 — Final API Contract](../Sprint2_APIs.md)
- [AGENTS.md](../AGENTS.md)
