# Quickstart & Validation Guide: Profile Education (Batch 2)

**Feature**: 006-profile-education
**Base URL (local)**: `http://localhost:3000/api/v1`
**Auth header**: `Authorization: Bearer <accessToken>`

**Prerequisite**: Batch 1 completed and running (`005-profile-foundation`).
**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Prerequisites

### Setup Commands

```bash
# 1. Seed education reference data (development mode)
pnpm ts-node scripts/seed-education-data.ts
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

## Cross-Batch Verification Checklist

| Check | Command | Expected Result |
|:---|:---|:---|
| Build | `pnpm build` | Exit 0, no TS errors |
| Lint | `pnpm lint` | Exit 0, no errors |
| Unit tests | `pnpm test` | All pass |
| E2E tests | `pnpm test:e2e` | All pass |
| matchingVersion after each mutation | `GET /profile/me` | Increments by 1 per write |
| Reference no-auth | Any `GET /reference/*` | 200 without Bearer |
| Completion increase | First education record | `completionPct += 25` |
