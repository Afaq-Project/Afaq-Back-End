# Feature Specification: Profile Documents (Batch 6)

**Feature Branch**: `010-profile-documents`

**Created**: 2026-09-21

**Status**: Planned

**Prerequisites**: Batch 5 (`009-profile-preferences`) MUST be complete and its Review Gate PASSED.

**Cross-cutting decisions**: See `docx/shared-research.md`

---

## Overview

This spec covers Batch 6 — Documents Section of the Profile v2 redesign.
Rewrites `DocumentsService` with storage-first deletion, replaces `docType`
string with `documentTypeId` FK, enforces file size and MIME type from
`SystemSettings`, adds document types reference endpoint.

---

## User Scenarios & Testing _(mandatory)_

### User Story 4 — Upload and Delete Documents Safely (Priority: P2)

A user uploads identity, academic, or financial documents. Each upload must specify
the document type from a predefined list rather than a free-text category. When the
user deletes a document, the system removes the file from storage first and only
marks the record as deleted after the storage operation succeeds. A storage failure
does not corrupt the database record.

**Why this priority**: Document uploads are a primary onboarding step for
applications. The storage-first deletion rule is a critical data-safety concern —
the current system's DB-first deletion can produce orphaned files with no recovery
path.

**Acceptance Scenarios**:

1. **Given** a user uploading a document, **When** the user submits the file with
   a valid document type selected from the master list, **Then** the system stores
   the file and creates a record with the file's size, MIME type, and display name.

2. **Given** a user deleting a document, **When** the deletion request is made,
   **Then** the system deletes the file from storage first; only upon storage
   success does it remove the database record.

3. **Given** a storage provider that fails during a deletion request, **When** the
   deletion attempt is made, **Then** the system returns an error to the user, and
   the database record remains intact so the user can retry later.

4. **Given** a user requesting a download of their document, **When** the request
   is authorized, **Then** the system returns a time-limited signed URL that
   allows direct file download.

5. **Given** a user submitting a document with a free-text category, **When** the
   request is submitted, **Then** the system rejects it — only a recognized
   document type ID is accepted.

---

## Requirements _(mandatory)_

### Functional Requirements

#### Documents

- **FR-033**: Document upload MUST require the user to specify a document type
  selected from the master list. Free-text document categories are NOT accepted.
- **FR-033b**: Document uploads MUST enforce a maximum file size and a whitelist of
  allowed MIME types. Both values MUST be read from SystemSettings with code-level
  fallback defaults.
- **FR-034**: Document deletion MUST be storage-first: the file MUST be removed from
  the storage provider before the database record is deleted. A storage failure MUST
  leave the database record intact and return an error to the user.
- **FR-035**: Document deletion MUST be permanent (hard-delete). No soft-delete or
  recovery mechanism is provided.
- **FR-036**: The system MUST provide a time-limited, authenticated download URL for
  each stored document.

---

### Key Entities

- **Document**: An uploaded file tied to a user profile. Classified by document type
  (master list). Storage and database lifecycle are explicitly sequenced: storage
  deletion precedes record deletion.

---

## Success Criteria

- **SC-004**: Document deletion leaves no orphaned files in storage when the deletion
  is successful. A failed storage deletion leaves the database record untouched 100%
  of the time.

---

## Assumptions

- Batch 5 is complete.
- Documents are stored in an S3-compatible storage provider.
- Default max file size: 10 MB (10,485,760 bytes).
- Default allowed MIME types: application/pdf, image/jpeg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document.
