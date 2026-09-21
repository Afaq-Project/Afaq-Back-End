# Quickstart & Validation Guide: Profile Preferences (Batch 5)

**Feature**: 009-profile-preferences
**Base URL (local)**: `http://localhost:3000/api/v1`
**Auth header**: `Authorization: Bearer <accessToken>`

**Prerequisite**: Batch 4 completed and running (`008-profile-tests`).

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

### Scenario 5.4 — Reference endpoint (no auth)

```bash
curl -s "http://localhost:3000/api/v1/reference/special-statuses" | jq '.data[0]'
```

**Expected**: 200 with `{ id, nameEn, nameAr }`. No auth needed.
