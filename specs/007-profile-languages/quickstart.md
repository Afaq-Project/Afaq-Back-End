# Quickstart & Validation Guide: Profile Languages (Batch 3)

**Feature**: 007-profile-languages
**Base URL (local)**: `http://localhost:3000/api/v1`
**Auth header**: `Authorization: Bearer <accessToken>`

**Prerequisite**: Batch 2 completed and running (`006-profile-education`).

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

### Scenario 3.3 — Proficiency levels ordered

```bash
curl -s "http://localhost:3000/api/v1/reference/proficiency-levels" | jq '.data | map(.sortOrder)'
```

**Expected**: Array ascending from 1 to 5 (Beginner → Native). No auth required.

---

### Scenario 3.4 — Build and lint pass

```bash
pnpm lint      # Must exit 0 with no errors
pnpm build     # Must compile with no TypeScript errors
pnpm test      # Unit tests pass
pnpm test:e2e  # E2E tests pass
```
