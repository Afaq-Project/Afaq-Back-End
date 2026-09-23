# Quickstart & Validation Guide: Profile Module v2 Redesign

**Feature**: 005-profile-v2-redesign
**Base URL (local)**: `http://localhost:3000/api/v1`
**Auth header**: `Authorization: Bearer <accessToken>`

---

## Prerequisites

### Environment

```bash
# Required environment variables
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...  # (Prisma Accelerate or direct URL)
JWT_SECRET=...
JWT_REFRESH_SECRET=...
STORAGE_PROVIDER=local        # or 's3'
```

### Setup Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Apply Batch 1 schema migration
pnpm prisma migrate dev --name v2-profile-redesign

# 3. Generate Prisma client
pnpm prisma generate

# 4. Start development server
pnpm start:dev
```

---

## Batch 1 — Validation Scenarios

### Scenario 1.1 — Auth returns tokens only

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' | jq
```

**Expected**: Response `data` contains `accessToken` and `refreshToken` only.
`userProfile` key MUST NOT appear anywhere in the response.

---

### Scenario 1.2 — Fetch empty profile

```bash
TOKEN="<accessToken from 1.1>"
curl -s http://localhost:3000/api/v1/profile/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected**:
```json
{
  "statusCode": 200,
  "data": {
    "userId": "<uuid>",
    "firstName": null,
    "lastName": null,
    "educations": [],
    "languages": [],
    "testResults": [],
    "specialStatuses": [],
    "targetDegrees": [],
    "targetMajors": [],
    "targetInstitutions": [],
    "documents": [],
    "completionPct": 0,
    "isMatchable": false,
    "matchingVersion": 1
  }
}
```

---

### Scenario 1.3 — Update personal info

```bash
curl -s -X PATCH http://localhost:3000/api/v1/profile/personal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Ahmad",
    "lastName": "Al-Najjar",
    "dateOfBirth": "2000-03-15",
    "gender": "MALE"
  }' | jq '.data.completionPct'
```

**Expected**: `completionPct` increases to 15 (firstName 3 + lastName 3 + dateOfBirth 5 + gender 4).

---

### Scenario 1.4 — Location update increases completion

```bash
curl -s -X PATCH http://localhost:3000/api/v1/profile/personal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryOfResidenceId": "<country-uuid>", "nationalityId": "<country-uuid>"}' \
  | jq '.data.completionPct'
```

**Expected**: Adds 8 + 7 = 15 points → total becomes 30.

---

### Scenario 1.5 — Verify System-Controlled Matchability

Matchability is determined by the system (`completionPct >= 60`). Attempting to update `isMatchable` directly is rejected as an unknown field.

**Request:**
```bash
curl -s -X PATCH http://localhost:3000/api/v1/profile/personal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isMatchable": true}'
```

**Expected (400 Bad Request):** The `forbidNonWhitelisted: true` rule rejects the unknown field.

---

### Scenario 1.5b — City/Country Mismatch Validation

**Request:**
```bash
curl -s -X PATCH http://localhost:3000/api/v1/profile/personal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryOfResidenceId": "uuid-jordan", "currentCityId": "uuid-ramallah"}'
```

**Expected (400 Bad Request):** `{"statusCode": 400, "message": "Selected city does not belong to the selected country", "error": "CITY_COUNTRY_MISMATCH"}`

---

### Scenario 1.6 — Reference endpoints require no auth

```bash
curl -s http://localhost:3000/api/v1/reference/countries | jq '.data[0]'
curl -s http://localhost:3000/api/v1/reference/marital-statuses | jq '.data[0]'
curl -s "http://localhost:3000/api/v1/reference/cities?countryId=<uuid>" | jq '.data[0]'
```

**Expected**: 200 responses with `{ id, nameEn, nameAr }` objects. No auth header needed.

---

### Scenario 1.7 — Build and lint pass

```bash
pnpm lint      # Must exit 0 with no errors
pnpm build     # Must compile with no TypeScript errors
pnpm test      # Unit tests pass
pnpm test:e2e  # E2E tests pass
```

---

## Batch 2 — Validation Scenarios

### Scenario 2.1 — Add education record

```bash
curl -s -X POST http://localhost:3000/api/v1/profile/educations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institutionId": "<institution-uuid>",
    "majorId": "<major-uuid>",
    "educationLevelId": "<level-uuid>",
    "startDate": "2020-09-01",
    "expectedGraduationDate": "2024-06-30",
    "isCurrent": true,
    "gpaRaw": 3.7,
    "gpaScale": "OUT_OF_4"
  }' | jq '.data'
```

**Expected**: Record returned. `gpaNormalized = 3.70` (OUT_OF_4, no conversion). Profile `completionPct` increases by 25.

---

### Scenario 2.2 — GPA normalization across scales

| Input | Scale | Expected gpaNormalized |
|:---|:---|:---|
| 85 | OUT_OF_100 | 3.40 |
| 4.5 | OUT_OF_5 | 3.60 |
| 3.7 | OUT_OF_4 | 3.70 |

---

### Scenario 2.3 — Duplicate education rejected

POST same `(institutionId, majorId, educationLevelId)` twice → `409 Conflict`.

---

### Scenario 2.4 — Reference endpoints (education)

```bash
curl -s "http://localhost:3000/api/v1/reference/majors?categoryId=<uuid>&search=Comp" | jq '.data[0]'
curl -s "http://localhost:3000/api/v1/reference/institutions?countryId=<uuid>" | jq '.data[0]'
```

**Expected**: Filtered results, no auth required.

### Scenario 2.5 — Fetch a single education record

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/profile/educations/<education-id>"
```

**Expected**: Returns the record; a random UUID returns `404 EDUCATION_NOT_FOUND`.

### Scenario 2.6 — isCurrent clears endDate

```bash
curl -s -X PATCH "http://localhost:3000/api/v1/profile/educations/<education-id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isCurrent": true, "endDate": "2024-06-15"}'
```

**Expected**: Assert the response has `endDate: null` and `isCurrent: true`.

### Scenario 2.7 — Minor major must differ from primary major

```bash
curl -s -X POST "http://localhost:3000/api/v1/profile/educations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"educationLevelId": "<uuid>", "institutionId": "<uuid>", "majorId": "<uuid-cs>", "minorMajorId": "<uuid-cs>"}'
```

**Expected**: Expect `400 MINOR_MAJOR_EQUALS_MAJOR`.

### Scenario 2.8 — Date range validation

```bash
curl -s -X POST "http://localhost:3000/api/v1/profile/educations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"educationLevelId": "<uuid>", "institutionId": "<uuid>", "majorId": "<uuid-cs>", "startDate": "2024-01-01", "endDate": "2023-01-01"}'
```

**Expected**: Expect `400 INVALID_DATE_RANGE`.

### Scenario 2.9 — Major categories pagination and filters

```bash
curl -s "http://localhost:3000/api/v1/reference/major-categories?search=Eng&page=1&limit=10"
```

**Expected**: Returns a paginated result with a `meta` object.


---

## Batch 3 — Validation Scenarios

### Scenario 3.1 — Add language with proficiency

```bash
curl -s -X POST http://localhost:3000/api/v1/profile/languages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"languageId": "<lang-uuid>", "proficiencyLevelId": "<level-uuid>", "isNative": false}' \
  | jq '.data | {languageId, isNative}'
```

**Expected**: Language record returned with `nameEn`/`nameAr` included.
`completionPct` increases by 10 (language group now met).

---

### Scenario 3.2 — Duplicate language rejected

POST same `languageId` twice → `409 Conflict`.

---

## Batch 4 — Validation Scenarios

### Scenario 4.1 — Add IELTS score

Assume IELTS: `minScore = 0, maxScore = 9, scoreStep = 0.5`.

```bash
curl -s -X POST http://localhost:3000/api/v1/profile/test-results \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"testId": "<ielts-uuid>", "score": 7.5, "testDate": "2024-01-15"}' | jq '.data'
```

**Expected**: Score accepted. `completionPct` increases by 7 (tests group met).

---

### Scenario 4.2 — Off-step score rejected

Score `7.3` for IELTS (step 0.5) → `400 Bad Request`.

---

### Scenario 4.3 — Out-of-range score rejected

Score `9.5` for IELTS (max 9.0) → `400 Bad Request`.

---

## Batch 5 — Validation Scenarios

### Scenario 5.1 — Add special status + target preferences

```bash
# Add special status
curl -s -X POST http://localhost:3000/api/v1/profile/special-statuses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"specialStatusId": "<uuid>"}' | jq '.statusCode'

# Add target major
curl -s -X POST http://localhost:3000/api/v1/profile/preferences/majors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"majorId": "<uuid>"}' | jq '.statusCode'
```

### Scenario 5.2 — Full profile completionPct = 100

After adding all required groups (personal info + location + education level +
education record + language + test + at least one of each preference group) →
`GET /profile/me` must return `completionPct: 100`.

### Scenario 5.3 — Idempotent preference add

Add same `majorId` twice → no error, no duplicate record. Result: exactly one row.

---

## Batch 6 — Validation Scenarios

### Scenario 6.1 — Upload a valid document

```bash
curl -s -X POST http://localhost:3000/api/v1/profile/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./tests/dummy.pdf;type=application/pdf" \
  -F "documentTypeId=<uuid>" | jq '.data | {id, displayName, mimeType}'
```

**Expected**: Document record returned with `storagePath`, `mimeType`, `sizeBytes`.

---

### Scenario 6.2 — Oversized file rejected

Upload a file > `MAX_DOCUMENT_SIZE_BYTES` → `400 Bad Request`.

---

### Scenario 6.3 — Invalid MIME type rejected

Upload `.exe` file (MIME `application/x-msdownload`) → `400 Bad Request`.

---

### Scenario 6.4 — Storage-first deletion

```bash
curl -s -X DELETE http://localhost:3000/api/v1/profile/documents/<id> \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: `204 No Content`. Document record is removed from DB. File removed from storage.

When storage is mocked to throw → `500` response. DB record must still exist after the request.

---

## Cross-Batch Verification Checklist

| Check | Command | Expected Result |
|:---|:---|:---|
| Build | `pnpm build` | Exit 0, no TS errors |
| Lint | `pnpm lint` | Exit 0, no errors |
| Unit tests | `pnpm test` | All pass |
| E2E tests | `pnpm test:e2e` | All pass |
| matchingVersion after each mutation | `GET /profile/me` | Increments by 1 per write |
| Auth response | `POST /auth/login` | No `userProfile` key in response |
| Reference no-auth | Any `GET /reference/*` | 200 without Bearer |
| Completion accuracy | Full profile | `completionPct = 100` |

---

## Smoke Test Collection

The Postman smoke test collection is maintained at:
`tests/levora-smoke-tests.json`

Import into Postman and set `baseUrl = http://localhost:3000`. Run the full
collection in sequence — requests are ordered by dependency (login first, then
profile operations). Each request contains `Tests` tab assertions for status code
and response structure.
