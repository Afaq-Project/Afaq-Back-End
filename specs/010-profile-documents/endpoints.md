# Profile Documents (Batch 6) — Endpoints

**Feature**: Profile Documents (Batch 6)
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/profile/documents` | 🔒 | Upload a document |
| 2 | `GET` | `/profile/documents` | 🔒 | List all documents |
| 3 | `GET` | `/profile/documents/:id/download` | 🔒 | Get signed download URL |
| 4 | `DELETE` | `/profile/documents/:id` | 🔒 | Delete a document (storage-first) |
| 5 | `GET` | `/reference/document-types` | 🌐 | List document types |

---

See `specs/006-profile-education/endpoints.md` Cross-Endpoint Conventions for standard
response envelope, HTTP codes, validation rules, and Swagger requirements.

---

## 1. `POST /api/v1/profile/documents`

**Auth**: Bearer JWT

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `file` | File | Yes | Max size from SystemSettings (default 10 MB) |
| `documentTypeId` | UUID | Yes | FK to DocumentTypes |

**Validation:**
- File size ≤ `MAX_DOCUMENT_SIZE_BYTES` → 400 if exceeded
- `file.mimetype` in `ALLOWED_DOCUMENT_MIME_TYPES` → 400 if disallowed
- `documentTypeId` must exist → 400 if not found

**Response — 201 Created**:

```json
{
  "statusCode": 201,
  "message": "Document uploaded successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "documentTypeId": "uuid",
    "documentType": { "nameEn": "Transcript", "nameAr": "كشف الدرجات" },
    "displayName": "transcript.pdf",
    "storagePath": "users/uuid/documents/abc123.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 204800,
    "createdAt": "2026-09-21T00:00:00.000Z"
  },
  "timestamp": "2026-09-21T00:00:00.000Z"
}
```

**Error Responses**: 400 FILE_TOO_LARGE, 400 MIME_NOT_ALLOWED, 400 INVALID_DOCUMENT_TYPE, 401 UNAUTHORIZED, 500 INTERNAL_ERROR.

---

## 2. `GET /api/v1/profile/documents`

**Auth**: Bearer JWT

**Response — 200 OK**: Array of document records with embedded `documentType`.

---

## 3. `GET /api/v1/profile/documents/:id/download`

**Auth**: Bearer JWT

Returns a signed URL valid for 15 minutes.

**Response — 200 OK**:

```json
{
  "statusCode": 200,
  "message": "Download URL generated",
  "data": { "signedUrl": "https://storage.example.com/...?token=...&expires=..." },
  "timestamp": "2026-09-21T00:00:00.000Z"
}
```

**Error Responses**: 401 UNAUTHORIZED, 404 DOCUMENT_NOT_FOUND, 500 INTERNAL_ERROR.

---

## 4. `DELETE /api/v1/profile/documents/:id`

**Auth**: Bearer JWT

Deletion is **storage-first**:
1. Storage file deleted.
2. DB record deleted (only if step 1 succeeds).
3. If storage fails → 500, DB record preserved.

**Response — 204 No Content**.

**Error Responses**: 401 UNAUTHORIZED, 404 DOCUMENT_NOT_FOUND, 500 STORAGE_DELETE_FAILED.

---

## 5. `GET /api/v1/reference/document-types` [PUBLIC]

**Response — 200 OK**:

```json
{
  "statusCode": 200,
  "message": "Document types retrieved successfully",
  "data": [
    { "id": "uuid", "nameEn": "Academic Transcript", "nameAr": "كشف الدرجات" },
    { "id": "uuid", "nameEn": "Passport Copy", "nameAr": "نسخة من جواز السفر" },
    { "id": "uuid", "nameEn": "Recommendation Letter", "nameAr": "خطاب توصية" }
  ],
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```
