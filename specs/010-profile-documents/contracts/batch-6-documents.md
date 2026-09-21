# API Contract — Batch 6: Documents

## Document Upload

### POST /profile/documents

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `file` | File | Yes | Max size from SystemSettings (default 10 MB) |
| `documentTypeId` | UUID | Yes | FK to DocumentTypes |

**Validation:**
- File size ≤ `MAX_DOCUMENT_SIZE_BYTES` → 400 if exceeded
- `file.mimetype` in `ALLOWED_DOCUMENT_MIME_TYPES` → 400 if disallowed
- `documentTypeId` must exist → 400 if not found

**Response:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "documentTypeId": "uuid",
  "documentType": { "nameEn": "Transcript", "nameAr": "كشف الدرجات" },
  "displayName": "transcript.pdf",
  "storagePath": "users/uuid/documents/abc123.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 204800,
  "createdAt": "2026-09-21T00:00:00.000Z"
}
```

---

### GET /profile/documents

Returns all documents for the authenticated user.

---

### GET /profile/documents/:id/download

Returns a signed URL valid for 15 minutes.

**Response:**

```json
{ "signedUrl": "https://storage.example.com/...?token=...&expires=..." }
```

---

### DELETE /profile/documents/:id

Deletion is **storage-first**:
1. Storage file deleted.
2. DB record deleted (only if step 1 succeeds).
3. If storage fails → 500, DB record preserved.

**Success response**: 204 No Content.

---

## Reference [PUBLIC]

### GET /reference/document-types

```json
[
  { "id": "uuid", "nameEn": "Academic Transcript", "nameAr": "كشف الدرجات" },
  { "id": "uuid", "nameEn": "Passport Copy", "nameAr": "نسخة من جواز السفر" },
  { "id": "uuid", "nameEn": "Recommendation Letter", "nameAr": "خطاب توصية" }
]
```
