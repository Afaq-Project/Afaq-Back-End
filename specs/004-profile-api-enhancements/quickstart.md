# Quickstart Validation Guide: Profile API Enhancements & Reference Data Expansion

**Feature**: 004-profile-api-enhancements | **Phase**: 1 — Design
**Date**: 2026-09-18

---

## Prerequisites

- Local NestJS server running on `http://localhost:3000` (`pnpm start:dev`)
- Local PostgreSQL database seeded (`npx prisma db seed`)
- Prisma migration applied (`npx prisma migrate dev`)
- `curl` or a Postman/Newman client available

---

## Setup Commands (run in order)

```bash
# 1. Apply migration (creates education_levels table)
npx prisma migrate dev --name add-education-levels

# 2. Seed education levels and verify
npx prisma db seed
# Expected output lines:
#   ✔ Seeded 7 education levels
#   ✔ Seeded 27 skills
#   ✔ Seeded 10 languages

# 3. Verify table directly
npx prisma studio   # or:
psql -d mydb -c "SELECT name, label_en FROM education_levels ORDER BY name;"
```

---

## Validation Scenarios

### Scenario 1 — Reference: Education Levels

```bash
curl -s http://localhost:3000/api/v1/reference/education-levels | jq '.data | length'
```
**Expected**: `7`

```bash
curl -s http://localhost:3000/api/v1/reference/education-levels | jq '.data[0]'
```
**Expected**: object containing `id`, `name`, `labelEn`, `labelAr`, `isActive: true`

---

### Scenario 2 — Reference: Languages with Search & Pagination

```bash
# No params — first page
curl -s "http://localhost:3000/api/v1/reference/languages" | jq '.meta.pagination'
```
**Expected**: `{ "page": 1, "limit": 20, "total": 10, "totalPages": 1, "hasNext": false, "hasPrev": false }`

```bash
# Search filter
curl -s "http://localhost:3000/api/v1/reference/languages?search=eng" | jq '.data[].name'
```
**Expected**: `"English"` (only matching entries)

```bash
# Invalid limit — should fail
curl -s "http://localhost:3000/api/v1/reference/languages?limit=200" | jq '.status'
```
**Expected**: `400`

---

### Scenario 3 — Reference: App Languages

```bash
curl -s http://localhost:3000/api/v1/reference/app-languages | jq '.data[] | select(.code == "ar") | .dir'
```
**Expected**: `"rtl"`

```bash
curl -s http://localhost:3000/api/v1/reference/app-languages | jq '.data | length'
```
**Expected**: `6`

---

### Scenario 4 — Reference: Skills Taxonomy Dual Mode

```bash
# No params → grouped (meta should be null)
curl -s http://localhost:3000/api/v1/reference/skills-taxonomy | jq '.meta'
```
**Expected**: `null`

```bash
# With search → flat paginated
curl -s "http://localhost:3000/api/v1/reference/skills-taxonomy?search=java" | jq '.meta.pagination'
```
**Expected**: pagination object with `total >= 1`

---

### Scenario 5 — Profile Sub-Lists Pagination (requires auth token)

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@levora.app","password":"AdminPassword123!"}' \
  | jq -r '.data.accessToken')

# Skills — paginated
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/profile/skills?page=1&limit=5" | jq '.meta.pagination'
```
**Expected**: pagination object (even if total is 0)

```bash
# Documents — storagePath must be absent
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/profile/documents" | jq '.data[0] | has("storagePath")'
```
**Expected**: `false`

---

### Scenario 6 — Profile Completion Percentage

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/profile | jq '.data.completionPct'
```
**Expected**: integer between `0` and `100`

---

### Scenario 7 — Education Level Validation

```bash
# Valid value
curl -s -X PATCH http://localhost:3000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"educationLevel":"bachelor"}' | jq '.status'
```
**Expected**: `200`

```bash
# Invalid value
curl -s -X PATCH http://localhost:3000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"educationLevel":"summa_cum_laude"}' | jq '.status'
```
**Expected**: `400`

---

### Scenario 8 — UUID Route Param Security

```bash
# Non-UUID param → 400 (no auth needed to test rejection)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/profile/skills/not-a-valid-uuid | jq '.status'
```
**Expected**: `400`

---

### Scenario 9 — Rate Limiting on Auth

```bash
# Run 6 rapid login attempts (must produce a 429 on the 6th)
for i in {1..6}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"baduser@test.com","password":"wrongpass"}')
  echo "Attempt $i: $STATUS"
done
```
**Expected**: Attempts 1–5 return `401`, attempt 6 returns `429`.

---

### Scenario 10 — Full Newman Smoke Test Run

```bash
cd /home/abood/Project/Afaq/Afaq-backend
npx newman run tests/levora-smoke-tests.json \
  --env-var "baseUrl=http://localhost:3000/api/v1" \
  --reporters cli
```
**Expected**: `0 failures` across all requests and assertions.

---

## References

- API Contracts: [contracts/api-contracts.md](./contracts/api-contracts.md)
- Data Model: [data-model.md](./data-model.md)
- Full Spec: [spec.md](./spec.md)
- Sprint Report: [levora-sprint-report.md](file:///home/abood/.gemini/antigravity-cli/brain/01d086ba-95e6-4c8f-a118-cd90c350ebf0/levora-sprint-report.md)
