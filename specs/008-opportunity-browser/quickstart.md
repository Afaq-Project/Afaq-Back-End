# Quickstart Validation Guide — Opportunity Browser

**Branch**: `008-opportunity-browser` | **Date**: 2026-09-30

This document describes how to validate that the Opportunity Browser feature works end-to-end once implementation is complete. It is not a tutorial or code reference — see `plan.md`, `data-model.md`, and `contracts/` for those.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| Node.js | LTS (version matching `.nvmrc` or `package.json`) |
| pnpm | As specified in project root |
| PostgreSQL (main) | Running and seeded with the main app database |
| PostgreSQL (AI service) | Running and populated with opportunity data (from AI service team) |
| `.env` file | Includes `DATABASE_URL` (main) and `DATABASE_AIService_URL` (AI service) |
| AI Prisma client generated | `pnpm generate:ai` has been run after Task 1 |

### Environment Setup

```bash
# Install dependencies
pnpm install

# Generate the AI service Prisma client (new — added in Task 1)
pnpm generate:ai

# Start the dev server
pnpm start:dev
```

---

## Validation Scenarios

### Scenario 1: Default List Request

**Verifies**: FR-001, FR-002, FR-014 — default pagination and field set.

```bash
curl -s http://localhost:3000/api/v1/opportunities | jq .
```

**Expected outcome**:
- `statusCode: 200`
- `data` is an array with at most 20 items
- Each item contains exactly: `id`, `title`, `organization`, `country`, `deadline`, `opportunity_type`, `is_remote` — no other fields
- `meta` object present: `{ page: 1, limit: 20, total: <n>, pages: <n> }`

---

### Scenario 2: Filter by Country

**Verifies**: FR-003 — country filter.

```bash
curl -s "http://localhost:3000/api/v1/opportunities?country=Egypt" | jq '.data[] | .country'
```

**Expected outcome**: Every returned value is `"Egypt"`.

---

### Scenario 3: Keyword Search

**Verifies**: FR-006 — case-insensitive search in title and description.

```bash
curl -s "http://localhost:3000/api/v1/opportunities?q=master" | jq '.data[] | .title'
```

**Expected outcome**: Every title contains `"master"` (case-insensitive) OR the opportunity was matched via its description.

---

### Scenario 4: Field Selection

**Verifies**: FR-011, FR-013, FR-014 — `fields` parameter.

```bash
# Partial fields
curl -s "http://localhost:3000/api/v1/opportunities?fields=id,title,deadline" | jq '.data[0] | keys'
# Expected: ["deadline", "id", "title"]

# All fields
curl -s "http://localhost:3000/api/v1/opportunities?fields=*" | jq '.data[0] | keys | length'
# Expected: 19
```

---

### Scenario 5: Limit Cap

**Verifies**: FR-009 — `limit` silently clamped to 100 (EC-002).

```bash
curl -s "http://localhost:3000/api/v1/opportunities?limit=9999" | jq '{limit: .meta.limit, count: (.data | length)}'
```

**Expected outcome**: `meta.limit` is `100`; `data` contains at most 100 items. No error response.

---

### Scenario 6: Page Beyond Last

**Verifies**: FR-010 — empty result for out-of-range page (EC-003).

```bash
curl -s "http://localhost:3000/api/v1/opportunities?page=99999" | jq '{data_length: (.data | length), total: .meta.total}'
```

**Expected outcome**: `data_length: 0`; `meta.total` reflects the actual record count (non-zero). Status `200`.

---

### Scenario 7: Invalid Sort Field

**Verifies**: FR-007 — unknown sort field rejected (EC-004).

```bash
curl -s "http://localhost:3000/api/v1/opportunities?sort=password:asc" | jq '{statusCode, error: .error}'
```

**Expected outcome**: `statusCode: 400`, `error: "INVALID_SORT_FIELD"`.

---

### Scenario 8: Invalid Field in `fields`

**Verifies**: FR-012 — disallowed field rejected (EC-006).

```bash
curl -s "http://localhost:3000/api/v1/opportunities?fields=id,secret_column" | jq '{statusCode, error: .error}'
```

**Expected outcome**: `statusCode: 400`, `error: "INVALID_FIELD"`.

---

### Scenario 9: Invalid Date Range

**Verifies**: FR-005 — `deadline_from` > `deadline_to` rejected (EC-009).

```bash
curl -s "http://localhost:3000/api/v1/opportunities?deadline_from=2027-01-01&deadline_to=2026-01-01" | jq '{statusCode, error: .error}'
```

**Expected outcome**: `statusCode: 400`, `error: "INVALID_DATE_RANGE"`.

---

### Scenario 10: Detail — Valid ID

**Verifies**: FR-015 — full detail object returned.

```bash
# Grab first ID from list
ID=$(curl -s "http://localhost:3000/api/v1/opportunities" | jq -r '.data[0].id')

curl -s "http://localhost:3000/api/v1/opportunities/$ID" | jq '{statusCode, keys: (.data | keys | length)}'
```

**Expected outcome**: `statusCode: 200`; `keys` count is `19` (all whitelisted fields).

---

### Scenario 11: Detail — Non-Existent ID

**Verifies**: FR-016 — 404 for missing record (EC-020).

```bash
curl -s "http://localhost:3000/api/v1/opportunities/00000000-0000-0000-0000-000000000000" | jq '{statusCode, error: .error}'
```

**Expected outcome**: `statusCode: 404`, `error: "OPPORTUNITY_NOT_FOUND"`.

---

### Scenario 12: Detail — Invalid UUID Format

**Verifies**: EC-021 — `ParseUUIDPipe` rejects malformed ID.

```bash
curl -s "http://localhost:3000/api/v1/opportunities/not-a-uuid" | jq '{statusCode, error: .error}'
```

**Expected outcome**: `statusCode: 400`, `error: "VALIDATION_ERROR"`.

---

### Scenario 13: Public Access (No Token)

**Verifies**: SC-001 — both endpoints are public (ST-001).

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/opportunities
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/v1/opportunities/$ID"
# Expected: 200
```

---

### Scenario 14: Startup Fails Without AI Database URL

**Verifies**: SC-003, FR-018 — fail-fast on missing env var (ST-003).

```bash
# Temporarily unset the variable and try to start
DATABASE_AIService_URL="" pnpm start:dev 2>&1 | head -20
```

**Expected outcome**: Application fails to start with a descriptive config validation error. It does not start silently misconfigured.

---

## Build & Test Gates

After all scenarios pass manually, run the automated suite:

```bash
pnpm build        # Must exit 0
pnpm lint         # Must exit 0
pnpm test         # All unit tests pass; opportunities.service.spec.ts coverage >= 80%
pnpm test:e2e     # All E2E tests in test/opportunities.e2e-spec.ts pass
```

See `quality-and-security.md §2.6` for the FR traceability matrix, and `§4` for the full security test register (ST-001 through ST-011).
