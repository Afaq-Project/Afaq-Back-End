# Data Model: Profile Documents (Batch 6)

**Feature**: 010-profile-documents
**Date**: 2026-09-21
**Schema version**: 2.0 (canonical source: `docx/complete-schema.md`)

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Entities Managed in this Spec

This spec owns `Documents` and uses `DocumentTypes` (seeded in Batch 1).

---

## Core Entity

### Documents — User Documents

| Column | Type | Nullable | Notes |
|:---|:---|:---:|:---|
| `id` | UUID PK | No | |
| `userId` | UUID FK | No | → `UserProfiles.userId` |
| `documentTypeId` | UUID FK | No | → `DocumentTypes.id` |
| `displayName` | TEXT | No | Human-readable file name |
| `storagePath` | TEXT | No | Storage provider key/path |
| `mimeType` | TEXT | No | Validated against SystemSettings whitelist |
| `sizeBytes` | INT | No | Validated against SystemSettings max |
| `createdAt` | TIMESTAMPTZ | No | |
| `updatedAt` | TIMESTAMPTZ | Yes | |

**No soft-delete**: Hard-delete only, storage-first.

**Upload constraints**: Both `MAX_DOCUMENT_SIZE_BYTES` (default 10 MB) and
`ALLOWED_DOCUMENT_MIME_TYPES` read from SystemSettings with fallback defaults.

---

## Storage-First Deletion Rule

See `docx/shared-research.md` § 6 for full rationale.

1. `StorageService.delete(storagePath)` — if throws, propagate error, return 500. DB record unchanged.
2. On success → `prisma.documents.delete({ where: { id } })`.

---

## Reference Entity Used

| Entity | Table | Notes |
|:---|:---|:---|
| `DocumentTypes` | `document_types` | `nameEn`, `nameAr` |

---

## SystemSettings Keys Used

| Key | Default |
|:---|:---|
| `MAX_DOCUMENT_SIZE_BYTES` | 10485760 (10 MB) |
| `ALLOWED_DOCUMENT_MIME_TYPES` | JSON array: pdf, jpeg, png, msword, docx |

---

## FK Naming Conventions

| Field in Prisma | DB Column | References |
|:---|:---|:---|
| `userId` on Documents | `user_id` | `user_profiles.user_id` |
| `documentTypeId` | `document_type_id` | `document_types.id` |

All snake_case in DB, camelCase in TypeScript via `@map()`.
