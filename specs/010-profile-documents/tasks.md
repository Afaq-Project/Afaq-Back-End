> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/010-profile-documents/endpoints.md`.

# Tasks: Profile Documents (Batch 6)

**Branch**: `010-profile-documents`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Prerequisite**: `009-profile-preferences` Review Gate PASSED.

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Batch 6 — Documents Section

**Unblocks**: US4 (document upload, deletion, download)

**Review Gate**: Upload works with `documentTypeId` FK. Unknown MIME type or oversized
file → 400. Storage-first deletion: simulated storage failure leaves DB record intact.
Signed download URL returned. All tests pass.

---

### Track A — DocumentsService + DTO Rewrite *(parallel with Track B)*

- [ ] T087 [P] [US4] Rewrite `src/modules/profile/dto/upload-document.dto.ts`. Remove `docType` string enum field entirely. Add `documentTypeId: string` (UUID, required, FK to `DocumentTypes`) — `src/modules/profile/dto/upload-document.dto.ts`
- [ ] T088 [P] [US4] Rewrite `src/modules/profile/services/documents.service.ts`. Implement: `upload(userId, file, dto)` — load `MAX_DOCUMENT_SIZE_BYTES` from `SystemSettings` (default 10485760); load `ALLOWED_DOCUMENT_MIME_TYPES` from `SystemSettings` (default: ["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]); validate `file.size <= maxSizeBytes` → 400 if exceeded; validate `file.mimetype` in allowed list → 400 if not; validate `documentTypeId` exists in `DocumentTypes` → 400 if not found; upload file via `StorageService`; create `Documents` record with `storagePath` (path returned by storage), `displayName` (original filename), `mimeType`, `sizeBytes`, `documentTypeId`, `userId` (FK to `UserProfiles.userId`). `findAll(userId)`: return all documents with `{ documentType: { nameEn, nameAr } }`. `getDownloadUrl(userId, id)`: validate ownership (404 if not found or mismatch); return signed URL via `StorageService.getSignedUrl(storagePath, 900)` (15-minute expiry). `delete(userId, id)`: 1) find record → 404 if not found; 2) call `StorageService.delete(storagePath)` — if this throws, re-throw immediately (DB record preserved); 3) only on storage success, delete DB record — `src/modules/profile/services/documents.service.ts`
- [ ] T089 [P] [US4] In `src/modules/profile/services/documents.service.ts`: remove all references to `isEncrypted` field from select/include blocks and create data. Remove all `deletedAt` handling and soft-delete logic — `src/modules/profile/services/documents.service.ts`
- [ ] T090 [P] [US4] Update `src/modules/profile/controllers/documents.controller.ts`. Verify `POST /profile/documents` accepts `multipart/form-data` with `file` and `documentTypeId`. Add `GET /profile/documents/:id/download` endpoint if missing. Add `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`, `@ApiConsumes('multipart/form-data')` where appropriate — `src/modules/profile/controllers/documents.controller.ts`

---

### Track B — Reference: Document Types *(parallel with Track A)*

- [ ] T091 [P] [US4] Add `getDocumentTypes()` to `src/modules/profile/services/reference.service.ts`. Returns `{ id, nameEn, nameAr }` — `src/modules/profile/services/reference.service.ts`
- [ ] T092 [P] [US4] Add `GET /reference/document-types` (`@Public()`) to `src/modules/profile/controllers/reference.controller.ts`. Add `@ApiOperation`, `@ApiResponse` — `src/modules/profile/controllers/reference.controller.ts`

---

### Track C — Tests *(runs after Tracks A and B complete)*

- [ ] T093 [US4] Create `src/modules/profile/services/documents.service.spec.ts`. Tests: `upload()` — valid file (correct size and MIME) succeeds; file exceeding max size → 400; disallowed MIME type → 400; unknown `documentTypeId` → 400; upload calls `StorageService.upload` and creates DB record. `delete()` — storage success → DB record deleted; storage throws → DB record preserved and error propagated. `getDownloadUrl()` — returns signed URL from `StorageService`; 404 if record not found — `src/modules/profile/services/documents.service.spec.ts`
- [ ] T094 [US4] Update `test/profile.e2e-spec.ts`. Add E2E tests: full upload/list/download/delete sequence; upload with oversized file → 400; upload with invalid MIME type → 400; upload with free-text docType (not documentTypeId) → 400; `GET /reference/document-types` returns 200 without auth. E2E test MUST include a simulated storage failure during DELETE /profile/documents/:id — use a mocked StorageService that throws on delete(). Assert the response is 5xx and the document record still exists in the database via a follow-up GET /profile/documents request. — `test/profile.e2e-spec.ts`
- [ ] T095 [US4] Update `tests/levora-smoke-tests.json` with document upload (multipart example), download URL, and delete requests. Add `Tests` assertions — `tests/levora-smoke-tests.json`
- [ ] T096 [US4] Update `Levora_API.postman_collection.json` and `Levora_API_localhost.postman_collection.json`. Add document upload entry (Content-Type: multipart/form-data, with `documentTypeId` and `file` fields). Add download URL and delete entries. Add reference endpoint entry — `Levora_API.postman_collection.json`, `Levora_API_localhost.postman_collection.json`
- [ ] T097 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e`. All must exit 0 — *(final gate)*

**✅ Batch 6 Review Gate**: Submit completion report per plan.md template. All 6 batches complete.

---

## Polish & Cross-Cutting Concerns

**Purpose**: Final verification pass ensuring all cross-batch invariants hold.

- [ ] T098 Verify all controller methods across all 6 batches have `@ApiOperation`, `@ApiResponse`, and `@ApiBearerAuth` (or `@Public()` for reference endpoints). No controller method is missing Swagger decorators — *(codebase audit)*
- [ ] T099 Verify `ProfileService.recalculate()` is called by every write operation across all services (educations, languages, test-results, special-statuses, preferences, documents). Grep for `recalculate` calls in all service files — *(codebase audit)*
- [ ] T100 Verify no service files contain business logic that belongs in controllers, and no controller contains DB queries or business logic. Confirm Controller → Service flow is intact across all new files — *(codebase audit)*
- [ ] T101 Run the full quickstart validation guide for all specs. Execute each scenario and confirm expected output — *(manual validation)*
- [ ] T102 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e` one final time on a clean state. All must exit 0. Verify the frontend coordination note has been delivered and acknowledged. — *(final gate)*
