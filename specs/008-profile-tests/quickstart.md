# Quickstart & Validation Guide: Profile Tests (Batch 4)

**Feature**: 008-profile-tests
**Base URL (local)**: `http://localhost:3000/api/v1`
**Auth header**: `Authorization: Bearer <accessToken>`

**Prerequisite**: Batch 3 completed and running (`007-profile-languages`).

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

### Scenario 4.4 — Reference endpoint (no auth)

```bash
curl -s "http://localhost:3000/api/v1/reference/standardized-tests" | jq '.data[0]'
```

**Expected**: Returns `{ id, nameEn, nameAr, minScore, maxScore, scoreStep }`. No auth needed.
