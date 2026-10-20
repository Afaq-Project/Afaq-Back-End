# Database Schema Integration Report: Wikso into Afaq-Backend

**Date:** October 16, 2026  
**Document Version:** 1.0  
**Target Project:** `Afaq-backend` (Levora Core Platform)  
**Source Project:** `wikso` (Knowledge Base & AI Assistant)  
**Location of Proposed Schema:** `docs/wikso-integration/integrated-schema.prisma`

---

## 1. Executive Summary & Guiding Principles

This report presents a comprehensive review of the database schemas of both the **Afaq-backend** and **Wikso** projects, followed by an architectural integration plan. 

### Core Mandates & Rules:
1. **Afaq-backend Tables Are Immutable Base Tables**: All 32 existing models in `Afaq-backend` are preserved **100% intact**. Not a single table, column, data type, default constraint, or existing foreign key relation in Afaq is modified or removed.
2. **All Adaptations Applied Exclusively to Wikso**: Features imported from Wikso are adapted, refactored, and reshaped to conform strictly to Afaq-backend's architectural guidelines (`AGENTS.md`) and database conventions.
3. **Collision Avoidance via Domain Namespacing**: All ported document/knowledge-base tables are prefixed with `wiki_` (e.g., `wiki_pages`, `wiki_spaces`, `wiki_comments`, `wiki_attachments`). This eliminates any semantic or technical collision with Afaq’s existing tables (notably Afaq’s existing `documents` table).
4. **WebSocket & Redundant Models Discarded**:
   - `yjsState` (the binary CRDT blob for WebSockets) is completely removed. Document storage relies exclusively on TipTap/ProseMirror JSON (`content_json`).
   - Wikso's authentication tables (`User`, `OAuthAccount`), notification table (`Notification`), audit table (`AuditLog`), and settings table (`SystemSettings`) are discarded in favor of Afaq-backend's existing models.
5. **Prisma Validation**: The proposed schema file (`docs/wikso-integration/integrated-schema.prisma`) has been compiled and validated directly against the Prisma CLI engine with zero errors (`The schema is valid 🚀`).

---

## 2. Side-by-Side Schema Analysis

| Feature / Standard | Afaq-backend Standard (Base) | Wikso (Original) | Integrated Architecture (Adapted Wikso) |
| :--- | :--- | :--- | :--- |
| **Primary Keys** | `UUID` with `gen_random_uuid()` via `@default(dbgenerated("gen_random_uuid()")) @db.Uuid` | `String` with `@default(uuid())` (text in PostgreSQL) | **Conformed to Afaq**: All ported models use native PostgreSQL `UUID` with `gen_random_uuid()`. |
| **Table Naming** | `snake_case` in DB via `@@map("table_names")` | `PascalCase` matching model names (e.g., `"Page"`) | **Conformed to Afaq**: `@@map("wiki_pages")`, `@@map("wiki_spaces")`, etc. |
| **Column Naming** | `camelCase` in TypeScript, `snake_case` in DB via `@map("column_name")` | Mixed camelCase direct column names | **Conformed to Afaq**: Every column explicitly mapped using `@map("snake_case")`. |
| **Timestamps** | `@db.Timestamptz(6)` with timezone | `DateTime` without explicit PostgreSQL timezone spec | **Conformed to Afaq**: Standardized to `@db.Timestamptz(6)`. |
| **User Entity** | Model `Users` (table `users`, UUID primary key) | Model `User` (table `User`, string text primary key) | **Re-routed**: All author, owner, and creator foreign keys reference Afaq's `Users` model. |
| **Document Storage** | JSON or S3 file paths | ProseMirror JSON + Yjs CRDT binary blob (`yjsState`) | **Streamlined**: `yjsState` dropped; TipTap JSON stored in `content_json`. |

---

## 3. Conflict & Collision Resolution

During the schema review, several critical naming and domain overlaps were identified and resolved:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Conflict Resolutions                             │
├───────────────────────┬──────────────────────┬──────────────────────────────┤
│ Overlapping Concept   │ Afaq Base Table      │ Wikso Resolution             │
├───────────────────────┼──────────────────────┼──────────────────────────────┤
│ Documents             │ documents            │ Renamed to wiki_pages        │
│ Attachments           │ documents            │ Renamed to wiki_attachments  │
│ User Identity         │ users                │ Dropped; re-linked to users  │
│ System Settings       │ system_settings      │ Wikso singleton dropped      │
│ Notifications         │ notifications        │ Wikso notifications dropped  │
│ Audit Logging         │ change_log           │ Wikso audit_log dropped      │
└───────────────────────┴──────────────────────┴──────────────────────────────┘
```

### Detailed Resolution Notes:
1. **The `Documents` vs `Pages` Collision**:
   - In **Afaq-backend**, `documents` represents user verification documents (passports, transcripts, diplomas, certificates) tied to candidate profiles with fields like `display_name`, `storage_path`, `mime_type`, `document_type_id`.
   - In **Wikso**, `Page` represented rich-text wiki documents, while `Attachment` represented inline media.
   - **Resolution**: Wikso's `Page` is mapped to `wiki_pages` (model `WikiPages`), and `Attachment` is mapped to `wiki_attachments` (model `WikiAttachments`). Afaq's `documents` table remains completely untouched.
2. **The `User` Collision & Foreign Key Integrity**:
   - Wikso's `User` model is discarded entirely.
   - All references to user accounts in Wikso (`ownerId`, `authorId`, `userId`, `uploaderId`, `createdById`) are refactored to point directly to `Users.id` in Afaq-backend as `UUID` foreign keys.
   - Reverse relation arrays (`wikiSpacesOwned`, `wikiPagesAuthored`, `wikiComments`, etc.) are declared on `Users` to provide full Prisma type safety and navigation without modifying any columns in the underlying PostgreSQL `users` table.
3. **The `SystemSettings` Collision**:
   - Afaq-backend uses a key-value store: `key String @id`, `value Json`, `description String?`.
   - Wikso's hardcoded singleton row (`id = "singleton"`) with fixed columns is discarded. Any system configuration needed by Wikso (e.g., `max_attachment_size_mb`) can be stored cleanly as a key-value pair inside Afaq's existing `system_settings` table.

---

## 4. Inventory of the Integrated Database Schema

The integrated database comprises **43 total models**:
- **32 Base Models** from Afaq-backend (100% Unchanged).
- **11 Adapted Models** specifically tuned for Afaq's Personal Drafts / Editor, AI Assistant, and Registration.

### Adapted Models Specification:

#### A. Personal Drafts & File Editing Subsystem (`draft_` namespace)
1. **`DraftSpaces` (`draft_spaces`)**:
   - User-scoped workspaces/projects (e.g., "Chevening 2026", "Personal Statements").
   - Fields: `id` (UUID), `slug` (varchar, scoped via `@@unique([ownerId, slug])`), `name`, `description`, `icon`, `owner_id` (FK to `users`), `created_at`, `updated_at`.
2. **`DraftPages` (`draft_pages`)**:
   - Hierarchical personal documents supporting nested folders and REST auto-saving.
   - Fields: `id` (UUID), `space_id` (FK), `parent_id` (self-referencing FK for nesting), `user_id` (FK to `users`), `document_id` (FK to `documents` for lineage tracking), `title`, `slug`, `content_json` (TipTap JSON), `status` (`DraftPageStatus`: DRAFT, IN_PROGRESS, FINALIZED, ARCHIVED), `position`, `deleted_at`, `deleted_by`.
3. **`DraftPageVersions` (`draft_page_versions`)**:
   - Historical snapshots recorded on auto-save or manual edits, plus finalization milestones.
   - Fields: `id`, `page_id` (FK), `user_id` (FK), `content_json` (JSON), `is_finalized_snapshot` (boolean), `finalized_document_id` (UUID), `created_at`.
4. **`DraftAttachments` (`draft_attachments`)**:
   - Embedded images and media inside draft pages. Storage path points to Afaq's S3 bucket.
   - Fields: `id`, `page_id` (FK), `uploader_id` (FK to `users`), `filename`, `mime_type`, `size_bytes`, `storage_path`, `created_at`.
5. **`DraftTags` (`draft_tags`) & `DraftPageTags` (`draft_page_tags`)**:
   - Color-coded taxonomy tags and many-to-many page associations per space.
6. **`DraftTemplates` (`draft_templates`)**:
   - Standardized document blueprints (e.g. "Standard CV Format", "Statement of Purpose Outline").

#### B. AI Writing Assistant Module
7. **`AiConversations` (`ai_conversations`)**:
   - Contextual chat assistant threads bound to Afaq users.
   - Fields: `id` (UUID), `user_id` (FK to `users`), `title`, `created_at`, `updated_at`.
8. **`AiMessages` (`ai_messages`)**:
   - Individual prompt and completion messages.
   - Fields: `id`, `conversation_id` (FK), `role` (user/assistant/system), `content` (text), `sources` (JSON metadata), `created_at`.
9. **`AiConfigs` (`ai_configs`)**:
   - Provider configurations, encrypted API keys, and model deployments for OpenAI and Anthropic.

#### C. Enhanced Authentication & Invitations Module
10. **`Invitations` (`invitations`)**:
    - Auditable invitation tokens allowing admins or mentors to invite users.
    - Fields: `id` (UUID), `email` (Citext), `token_hash` (unique SHA-256 hash), `role_id` (FK to `roles`), `invited_by_id` (FK to `users`), `accepted_at`, `expires_at`, `created_at`.

#### D. Streamlined & Excluded Models (Collaborative Clutter Eliminated)
- **Excluded**: `WikiComments`, `WikiCommentReactions`, `WikiGroups`, `WikiGroupMembers`, `WikiSpacePermissions`, `WikiPagePermissions`, `WikiPageWatches`, `WikiPageShares`, `WikiPageViews`, `WikiPageLinks`, `WikiFavorites`, `WikiRecentPages`.
- **Rationale**: Afaq requires a private personal file-editing and draft system, not a public collaborative wiki. Removing these eliminates over 50% of unnecessary endpoints and database overhead.

---

## 5. Migration Execution Strategy

1. Review `docs/wikso-integration/integrated-schema.prisma`.
2. Apply migration to dev environment.
3. Implement modules following `INTEGRATION_PLAN.md`.
