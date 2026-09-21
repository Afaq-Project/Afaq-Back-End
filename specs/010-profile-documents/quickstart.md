# Quickstart & Validation Guide: Profile Documents (Batch 6)

**Feature**: 010-profile-documents
**Base URL (local)**: `http://localhost:3000/api/v1`
**Auth header**: `Authorization: Bearer <accessToken>`

**Prerequisite**: Batch 5 completed and running (`009-profile-preferences`).

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

### Scenario 6.5 — Get signed download URL

```bash
curl -s http://localhost:3000/api/v1/profile/documents/<id>/download \
  -H "Authorization: Bearer $TOKEN" | jq '.data.signedUrl'
```

**Expected**: Returns a time-limited URL string.

---

### Scenario 6.6 — Reference endpoint (no auth)

```bash
curl -s "http://localhost:3000/api/v1/reference/document-types" | jq '.data[0]'
```

**Expected**: 200 with `{ id, nameEn, nameAr }`. No auth needed.
