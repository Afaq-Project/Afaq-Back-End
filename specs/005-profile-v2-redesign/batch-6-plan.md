# Batch 6 Plan (Documents Section)

## Full Task List and Dependency Graph
**Track A: DocumentsService rewrite (Parallel with Track B)**
- T087: Rewrite `src/modules/profile/dto/upload-document.dto.ts` (add `documentTypeId`, remove `docType`).
- T088: Rewrite `src/modules/profile/services/documents.service.ts` (Storage operations, validations, MIME sniffing).
- T089: Remove encryption and soft-delete from `documents.service.ts`.
- T090: Update `src/modules/profile/controllers/documents.controller.ts` (multipart/form-data support, download endpoint).

**Track B: Reference Document Types (Parallel with Track A)**
- T091: Add `getDocumentTypes()` to `src/modules/profile/services/reference.service.ts`.
- T092: Add `GET /reference/document-types` to `src/modules/profile/controllers/reference.controller.ts`.

**Track C: Tests (After Tracks A & B)**
- T093: Create `src/modules/profile/services/documents.service.spec.ts`.
- T094: Update `test/profile.e2e-spec.ts` (Add documents E2E, mocked storage failure test).
- T095: Update `tests/levora-smoke-tests.json`.
- T096: Update Postman collections.
- T097: Run checks (lint, build, test, e2e).

## Files Touched per Executor
**Track A Executor (`oma-executor`):**
- `src/modules/profile/dto/upload-document.dto.ts`
- `src/modules/profile/services/documents.service.ts`
- `src/modules/profile/controllers/documents.controller.ts`

**Track B Executor (`oma-executor`):**
- `src/modules/profile/services/reference.service.ts`
- `src/modules/profile/controllers/reference.controller.ts`

**Track C QA-Agent (`oma-executor`):**
- `src/modules/profile/services/documents.service.spec.ts`
- `test/profile.e2e-spec.ts`
- `tests/levora-smoke-tests.json`
- `Levora_API.postman_collection.json`
- `Levora_API_localhost.postman_collection.json`

## Acceptance Criteria per Endpoint
- `POST /api/v1/profile/documents`: Uploads file to storage. Validates max size (default 10MB) and MIME type. Uses content sniffing to ensure declared type matches actual content. Fails if invalid (400) or file too large (400). DOES NOT recalculate completion pct.
- `GET /api/v1/profile/documents`: Returns list of documents. Includes document type relation.
- `GET /api/v1/profile/documents/:id/download`: Returns a signed URL (15m expiry) from storage service. 404 on missing/mismatch.
- `DELETE /api/v1/profile/documents/:id`: Deletes file from storage *first*, then from DB. If storage delete throws, DB record is preserved. DOES NOT recalculate.
- `GET /api/v1/reference/document-types`: Returns all active document types (200 OK, Public).

## Storage Lifecycle Contract
- **Upload**: The file is first uploaded via `StorageService`. Only upon a successful upload does the database `Documents` record get created. If creating the database record fails (e.g. FK constraint or DB outage), the service MUST catch the error, attempt to clean up the uploaded file from the storage provider, and throw an error to the client.
- **Delete**: The `delete` operation strictly executes `StorageService.delete(storagePath)` first. If the storage service throws an error (e.g. AWS S3 outage), the error is thrown immediately to the client and the database record is **preserved**. Only if the storage deletion succeeds does the application proceed to delete the database record.

## Content Inspection Contract
- The service will read the actual bytes of the uploaded file to verify the true MIME type (file signature / magic bytes) instead of relying solely on the client-provided `mimetype` string in the request header or file extension.
- The `file-type` library (or similar byte inspection logic) will be used to ensure the sniffed content matches the allowed list and matches the declared type.

## Risk Register
1. **Risk:** Storage upload succeeds but DB insert fails, leaving orphaned files.
   **Mitigation:** Enforce a `try/catch` block around the DB creation that explicitly calls `StorageService.delete()` before re-throwing.
2. **Risk:** Deleting a document from DB but failing to delete from storage.
   **Mitigation:** The Storage Lifecycle Contract strictly orders storage deletion *before* DB deletion.
3. **Risk:** Client bypasses MIME restrictions by changing extensions.
   **Mitigation:** Content Inspection Contract enforces magic byte reading.
4. **Risk:** Large files consume too much memory before rejection.
   **Mitigation:** Strict `MAX_DOCUMENT_SIZE_BYTES` enforcement (ideally streamed or intercepted early by interceptors).
5. **Risk:** Overly complex file type parsing library breaks compilation or ESM.
   **Mitigation:** Use a compatible sync/async byte reader or native Buffer sniffing if ESM issues arise.
