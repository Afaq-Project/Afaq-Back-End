# Quickstart & Validation Guide: Profile Module v2 Redesign

**Feature**: 005-profile-foundation
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

Matchability is determined by the system (`completionPct >= 60`). Attempting to update `isMatchable` directly will fail or be ignored.

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
