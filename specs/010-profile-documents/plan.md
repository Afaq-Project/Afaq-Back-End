# Implementation Plan: Profile Documents (Batch 6)

**Branch**: `010-profile-documents` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Prerequisite**: Batch 5 Review Gate PASSED (`009-profile-preferences`).

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Summary

Batch 6 — Documents Section. Rewrite `DocumentsService` with storage-first deletion,
replace `docType` string with `documentTypeId` FK, enforce file size and MIME type
from `SystemSettings`, add document types reference endpoint.

**Review Gate**: Upload works with `documentTypeId`. Unknown MIME type or oversized
file → 400. Deletion is storage-first — a simulated storage failure leaves the DB record intact.
Signed download URLs work. All tests pass.

---

## Batch 6 — Parallel Execution Plan

### Track A — DocumentsService + DTO Rewrite

**Agent**: `oma-architect`

**Step A.1** — Rewrite `src/modules/profile/dto/upload-document.dto.ts`:
- Remove `docType` string enum field entirely.
- Add `documentTypeId: string` (UUID, required) — FK to `DocumentTypes`.

**Step A.2** — Rewrite `src/modules/profile/services/documents.service.ts`:
- `upload(userId, file, dto)`:
  - Load max file size from `SystemSettings.MAX_DOCUMENT_SIZE_BYTES` (default 10 MB).
  - Load allowed MIME types from `SystemSettings.ALLOWED_DOCUMENT_MIME_TYPES` (default JSON array).
  - Validate file size ≤ max. Reject 400 if exceeded.
  - Validate `file.mimetype` is in allowed list. Reject 400 if not.
  - Validate `documentTypeId` exists in `DocumentTypes`. Reject 400 if not.
  - Upload to storage provider via `StorageService`.
  - Create `Documents` record with `storageKey`, `fileName`, `mimeType`, `fileSize`,
    `documentTypeId`, `userId set to the authenticated user's ID`.
- `findAll(userId)`: Return all documents with `{ documentType: { nameEn, nameAr } }`.
- `getDownloadUrl(userId, id)`: Generate signed URL via `StorageService`. 404 if not found.
- `delete(userId, id)`:
  1. Find document record. 404 if not found.
  2. Call `StorageService.delete(storageKey)`.
  3. **Only if step 2 succeeds**: delete DB record.
  4. If step 2 throws: re-throw error; DB record is preserved.

**Step A.3** — Remove `isEncrypted` from all select/include blocks and DB writes.
Remove `deletedAt` handling — no soft-delete.

---

### Track B — Reference: Document Types (parallel with A)

**Agent**: `oma-quick`

Add `getDocumentTypes()` to `reference.service.ts`:
Returns `{ id, nameEn, nameAr }`.

Add `GET /reference/document-types` `@Public()`.

---

### Track C — Tests

**Agent**: `oma-reviewer`

Unit: `documents.service.spec.ts` — test upload (valid file passes, oversized
fails, disallowed MIME fails), test storage-first deletion (storage success →
DB deleted; storage throws → DB record retained and error propagated), test
download URL generation.

E2E: full upload/list/download/delete sequence; upload with oversized file (400);
upload with invalid MIME (400); simulated storage failure on delete → record persists.

Smoke + Postman: document upload (multipart/form-data example with `documentTypeId`),
download URL, delete.

---

## Batch 6 — Completion Report Template

| Method | Path | Auth | Body / Params | Response |
|:---:|:---|:---:|:---|:---|
| `POST` | `/api/v1/profile/documents` | Bearer | `multipart/form-data: file, documentTypeId` | Document record |
| `GET` | `/api/v1/profile/documents` | Bearer | — | `[DocumentRecord]` |
| `GET` | `/api/v1/profile/documents/:id/download` | Bearer | — | `{ signedUrl }` |
| `DELETE` | `/api/v1/profile/documents/:id` | Bearer | — | 204 |
| `GET` | `/api/v1/reference/document-types` | Public | — | `[{ id, nameEn, nameAr }]` |
