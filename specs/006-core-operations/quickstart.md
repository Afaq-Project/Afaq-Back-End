# Quickstart Validation Guide — Core Operations Module (Admin v1)

**Branch**: `006-core-operations` | **Date**: 2026-09-28

This guide describes how to validate the Core Operations module end-to-end once implementation is complete. It is NOT an implementation guide — see `tasks.md` for implementation tasks.

---

## Prerequisites

1. Local database running and migrated: `pnpm prisma migrate deploy`
2. Redis running locally (required for refresh-token operations)
3. Application started: `pnpm start:dev`
4. At minimum, seed the database with:
   - One `system_admin` user (email + password for login)
   - One `content_admin` user
   - One regular `user` (target for admin operations)
   - At least one `Institution` and one `Major` master record
   - One `SystemSettings` row for `matching.threshold` (value: `60`)
   - One `Document` record owned by the regular user

---

## Step 1 — Authenticate as `system_admin`

```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"AdminPass1!"}' | jq .
```

**Expected**: `200` with `accessToken` in response. Store it as `$TOKEN`.

---

## Step 2 — Dashboard Stats

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/operations/dashboard/stats | jq .
```

**Expected**: `200` with `data.users.total >= 1`, `data.documents.total >= 1`. No payment/subscription fields in response.

---

## Step 3 — List Users

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/operations/users?page=1&limit=10" | jq .
```

**Expected**: `200` with paginated `data` array. Regular user appears; no soft-deleted users.

---

## Step 4 — Suspend User

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  http://localhost:3000/api/v1/operations/users/$USER_ID/status | jq .
```

**Expected**: `204`. Verify the user can no longer refresh their token (refresh call should return `401`).

---

## Step 5 — Force Logout

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/operations/users/$USER_ID/force-logout | jq .
```

**Expected**: `204`. Verify the user's refresh token is rejected by `POST /auth/refresh`.

---

## Step 6 — Bulk Status Update (cap validation)

```bash
# 101 IDs — should fail
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userIds":["'"$(python3 -c "print('","'.join(['00000000-0000-0000-0000-000000000000']*101))"'"],"isActive":false}' \
  http://localhost:3000/api/v1/operations/users/bulk/status | jq .
```

**Expected**: `400 VALIDATION_ERROR`.

---

## Step 7 — Soft-Delete User

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/operations/users/$USER_ID | jq .
```

**Expected**: `204`. Verify `GET /operations/users/$USER_ID` returns `404 USER_NOT_FOUND`.

---

## Step 8 — Update System Setting

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":70}' \
  http://localhost:3000/api/v1/operations/settings/matching.threshold | jq .
```

**Expected**: `200` with updated `value: 70`. Dashboard stats should now reflect the new threshold.

---

## Step 9 — Reference Data: Deactivate an Institution

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  http://localhost:3000/api/v1/operations/reference/institutions/$INSTITUTION_ID | jq .
```

**Expected**: `200`. Verify the institution no longer appears in `GET /api/v1/reference/institutions` (public endpoint).

---

## Step 10 — Audit Log Review

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/operations/audit-logs | jq .
```

**Expected**: `200` with entries for the suspension and soft-delete performed above. Each entry has `changedBy` equal to the admin's UUID.

```bash
# Detail view
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/operations/audit-logs/$LOG_ID | jq .
```

**Expected**: `200` with `oldData`, `newData`, and actor UUID. No `password` or token fields in payloads.

---

## Step 11 — Document Admin Download

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/operations/documents/$DOC_ID/download | jq .
```

**Expected**: `200` with `data.url` (signed URL) and `data.expiresIn: 900`.

---

## Step 12 — Permission Guard Verification

```bash
# Authenticate as content_admin
curl -s -c cookies2.txt -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"content@test.com","password":"ContentPass1!"}' | jq .

# Try to delete a document (requires documents:delete — only system_admin)
curl -s -X DELETE -H "Authorization: Bearer $CONTENT_TOKEN" \
  http://localhost:3000/api/v1/operations/documents/$DOC_ID | jq .
```

**Expected**: `403 FORBIDDEN`.

---

## Acceptance Gate

All 12 steps pass with expected status codes → module is ready for review. Run the full test suite to confirm:

```bash
pnpm test
pnpm test:e2e
pnpm build
pnpm lint
```

All must pass with zero errors.
