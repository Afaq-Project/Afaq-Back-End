# Data Model: Personal Drafts & Document Editor Integration

**Feature Branch**: `010-personal-drafts-editor`  
**Date**: 2026-10-17  
**Status**: Completed  
**Reference Schema**: `docs/wikso-integration/integrated-schema.prisma`  

---

## 1. Domain Entities & Database Schema

The subsystem introduces **11 adapted models** that integrate seamlessly alongside Afaq's existing 32 base tables.

```
┌─────────────────┐        ┌──────────────────┐
│   Users (Base)  │        │ Documents (Base) │
└────────┬────────┘        └────────┬─────────┘
         │ 1:N                      │ 1:N
         │ (ownerId / userId)       │ (lineage)
         ▼                          ▼
┌─────────────────┐ 1:N    ┌──────────────────┐ 1:N    ┌───────────────────────┐
│   DraftSpaces   ├───────►│    DraftPages    ├───────►│   DraftPageVersions   │
└────────┬────────┘        └────────┬─────────┘        └───────────────────────┘
         │ 1:N                      │ 1:N
         ├──────────────┐           └──────────────┐
         ▼              ▼                          ▼
┌─────────────────┐ ┌───────────────┐      ┌───────────────────────┐
│    DraftTags    │ │DraftTemplates │      │   DraftAttachments    │
└─────────────────┘ └───────────────┘      └───────────────────────┘
```

---

### Entity 1: `DraftSpaces` (`draft_spaces`)
Top-level workspaces/project folders owned by an individual candidate to organize related application materials.

| Field | Type | DB Column | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | `id` | UUID, Primary Key, `gen_random_uuid()` | Unique workspace identifier |
| `slug` | String | `slug` | VarChar(255), Not Null | URL-safe workspace slug |
| `name` | String | `name` | VarChar(255), Not Null | Display title (e.g., "Chevening 2026") |
| `description`| String?| `description` | Text, Nullable | Optional notes on application goals |
| `icon` | String?| `icon` | VarChar(100), Nullable | Lucide icon identifier or emoji |
| `ownerId` | String | `owner_id` | UUID, FK to `users.id`, `onDelete: Cascade` | Owning candidate ID |
| `createdAt` | DateTime| `created_at` | Timestamptz(6), Default `now()` | Timestamp created |
| `updatedAt` | DateTime?| `updated_at`| Timestamptz(6), Auto-updated | Timestamp last modified |

**Indexes & Constraints**:
- `@@unique([ownerId, slug])` — Ensures user-scoped slug uniqueness without cross-user collisions.
- `@@index([ownerId])` — Fast lookup of all candidate workspaces.

---

### Entity 2: `DraftPages` (`draft_pages`)
Hierarchical rich-text documents supporting ProseMirror AST JSON, nesting, and official document lineage.

| Field | Type | DB Column | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | `id` | UUID, Primary Key, `gen_random_uuid()` | Unique document identifier |
| `spaceId` | String | `space_id` | UUID, FK to `draft_spaces.id`, `onDelete: Cascade` | Parent workspace ID |
| `parentId` | String?| `parent_id`| UUID, Self-FK to `draft_pages.id`, `onDelete: Cascade` | Parent document ID for nesting |
| `userId` | String | `user_id` | UUID, FK to `users.id`, `onDelete: Cascade` | Author/Owner candidate ID |
| `documentId`| String?| `document_id`| UUID, FK to `documents.id`, `onDelete: SetNull` | Linked official document ID |
| `title` | String | `title` | VarChar(500), Not Null | Document title (e.g., "Personal Statement") |
| `slug` | String | `slug` | VarChar(500), Not Null | Document URL slug |
| `contentJson`| Json? | `content_json`| JSON, Nullable | TipTap / ProseMirror structured document AST |
| `status` | Enum | `status` | `DraftPageStatus`, Default `DRAFT` | Lifecycle state |
| `position` | Int | `position` | Integer, Default `0` | Sibling ordering position |
| `deletedAt`| DateTime?| `deleted_at`| Timestamptz(6), Nullable | Soft deletion timestamp (Trash support) |
| `deletedBy`| String?| `deleted_by`| UUID, Nullable | Actor who placed document in trash |
| `createdAt`| DateTime| `created_at` | Timestamptz(6), Default `now()` | Creation timestamp |
| `updatedAt`| DateTime?| `updated_at`| Timestamptz(6), Auto-updated | Last auto-save timestamp |

**Indexes & Constraints**:
- `@@index([spaceId, deletedAt])` — Filters active vs. trashed pages within workspace.
- `@@index([userId])` — User-scoped query optimization.
- `@@index([documentId])` — Quick resolution of drafts derived from uploaded documents.
- `@@index([parentId])` — Tree-structure hierarchy queries.

---

### Entity 3: `DraftPageVersions` (`draft_page_versions`)
Immutable historical snapshots of draft pages created on auto-save milestones or explicit finalizations.

| Field | Type | DB Column | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | `id` | UUID, Primary Key, `gen_random_uuid()` | Unique snapshot identifier |
| `pageId` | String | `page_id` | UUID, FK to `draft_pages.id`, `onDelete: Cascade`| Associated draft page |
| `userId` | String | `user_id` | UUID, FK to `users.id`, `onDelete: Cascade` | Candidate who authored revision |
| `contentJson`| Json | `content_json`| JSON, Not Null | Full TipTap AST snapshot |
| `isFinalizedSnapshot`| Boolean | `is_finalized_snapshot` | Boolean, Default `false` | True if snapshot represents finalization |
| `finalizedDocumentId`| String? | `finalized_document_id`| UUID, Nullable | Linked ID in `documents` if finalized |
| `createdAt` | DateTime| `created_at` | Timestamptz(6), Default `now()` | Snapshot creation timestamp |

**Indexes**:
- `@@index([pageId, createdAt(sort: Desc)])` — Reverse chronological version retrieval.
- `@@index([userId])` — User audit index.

---

### Entity 4: `DraftAttachments` (`draft_attachments`)
Embedded media files and images referenced within rich-text draft documents.

| Field | Type | DB Column | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | `id` | UUID, Primary Key, `gen_random_uuid()` | Attachment ID |
| `pageId` | String | `page_id` | UUID, FK to `draft_pages.id`, `onDelete: Cascade` | Parent draft page |
| `uploaderId`| String | `uploader_id` | UUID, FK to `users.id`, `onDelete: Cascade` | Candidate uploader |
| `filename` | String | `filename` | VarChar(255), Not Null | Original filename |
| `mimeType` | String | `mime_type` | VarChar(100), Not Null | MIME type (e.g. `image/png`) |
| `sizeBytes` | Int | `size_bytes` | Integer, Not Null | File size in bytes |
| `storagePath`| String | `storage_path`| Text, Not Null | S3 storage key path |
| `createdAt` | DateTime| `created_at` | Timestamptz(6), Default `now()` | Upload timestamp |

---

### Entity 5 & 6: `DraftTags` & `DraftPageTags`
Taxonomy tags for categorizing drafts by opportunity type, deadline, or status.

- `DraftTags`: `id` (UUID), `spaceId` (FK), `name` (VarChar), `color` (VarChar), `createdAt`. `@@unique([spaceId, name])`.
- `DraftPageTags`: `pageId` (FK), `tagId` (FK). `@@id([pageId, tagId])`.

---

### Entity 7: `DraftTemplates` (`draft_templates`)
Reusable document blueprints (e.g., "Chevening Essay Format", "Europass CV Template").

- `DraftTemplates`: `id` (UUID), `title`, `description`, `contentJson`, `category`, `icon`, `isDefault`, `spaceId` (optional), `creatorId` (optional FK to `users`), `createdAt`, `updatedAt`.

---

### Entity 8, 9 & 10: AI Assistant Subsystem
Contextual memory and model configurations for the in-editor AI writing assistant.

- `AiConversations`: `id` (UUID), `userId` (FK to `users`), `title`, `createdAt`, `updatedAt`. `@@index([userId, updatedAt(sort: Desc)])`.
- `AiMessages`: `id` (UUID), `conversationId` (FK), `role` (user/assistant/system), `content` (Text), `sources` (Json metadata), `createdAt`.
- `AiConfigs`: `id` (UUID), `provider` (unique: "openai" / "anthropic"), `apiKey` (encrypted), `endpoint`, `model`, `deployment`, `apiVersion`, `isActive` (boolean).

---

### Entity 11: `Invitations` (`invitations`)
Controlled, auditable onboarding tokens for pilot candidates and institutional cohorts.

- `Invitations`: `id` (UUID), `email` (Citext), `tokenHash` (unique SHA-256 hash), `roleId` (FK to `roles`), `invitedById` (FK to `users`), `acceptedAt` (DateTime?), `expiresAt` (DateTime), `createdAt`. `@@index([email])`, `@@index([tokenHash])`.

---

## 2. Document Lifecycle State Machine

```
   ┌────────────────────────────────────────────────────────────┐
   │                                                            │
   ▼                                                            │
[ DRAFT ] ──(Auto-Save / Edit)──► [ IN_PROGRESS ]               │
                                         │                      │
                                 (Finalize Draft)               │
                                         ▼                      │
                                   [ FINALIZED ]                │
                               (Read-Only in Editor)            │
                                         │                      │
                               (Unlock / New Revision)          │
                                         └──────────────────────┘
```

### State Transitions:
1. **`DRAFT` → `IN_PROGRESS`**: Triggered on initial content input and first auto-save.
2. **`IN_PROGRESS` → `FINALIZED`**:
   - Triggered when the user confirms document finalization.
   - The editor UI locks to read-only mode.
   - Puppeteer renders the HTML-to-PDF output and uploads it to S3.
   - A new row is inserted into `documents` table with `displayName`, `storagePath`, and `mimeType = "application/pdf"`.
   - The candidate's profile is updated to set this new document as the **active, approved version**.
   - A snapshot is logged in `draft_page_versions` with `isFinalizedSnapshot = true` and `finalizedDocumentId`.
3. **`FINALIZED` → `IN_PROGRESS`**:
   - Triggered when the candidate explicitly clicks **"Unlock / New Revision"**.
   - Read-only lock is released. Subsequent auto-saves accumulate as new versions.
   - A subsequent finalization generates a new versioned official document (e.g., `CV_v2.pdf`), preserving the first finalized document intact in repository history.
4. **Any State → `ARCHIVED` / Soft-Deleted**:
   - When a draft is deleted, `deletedAt = now()` is set, moving it to Trash.
   - Trashed drafts can be restored within 30 days or permanently purged by the owner.
