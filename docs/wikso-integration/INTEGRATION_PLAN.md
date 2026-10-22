# Master Integration Plan: Wikso into Afaq-Backend (Personal Drafts & AI Editor)

**Project:** Levora / Afaq-Backend  
**Document Version:** 3.0  
**Updated:** October 17, 2026  
**Reference Schema:** `docs/wikso-integration/integrated-schema.prisma`  
**Reference Report:** `docs/wikso-integration/DATABASE_SCHEMA_INTEGRATION_REPORT.md`  

---

## 1. Objectives & Guiding Architecture

The objective is to integrate **a personal rich-text file-editing system (Personal Drafts/Editor), REST auto-save, an in-editor AI writing assistant, an in-app notification engine, an official document finalization pipeline, and enhanced registration controls** into `Afaq-backend`.

### Core Architectural Decisions:
1. **Afaq-Backend is the Immutable Foundation**: Afaq's existing 32 tables, authentication, user lifecycle, and opportunity matching models remain completely intact.
2. **Personal Drafts Subsystem (User-Scoped & Private by Default)**:
   - Replaces collaborative wiki clutter. Each user manages their own private draft spaces and documents.
   - Slugs are scoped per user (`@@unique([ownerId, slug])`).
   - Collaborative features (comments, reactions, groups, space permissions, page watches, public shares) are **completely excluded**.
3. **REST Auto-Save (Zero WebSockets)**:
   - Real-time WebSockets (`hocuspocus`, `yjs`) are completely eliminated.
   - Frontend auto-saves TipTap JSON (`content_json`) via `PATCH /api/v1/drafts/spaces/:slug/pages/:pageId`.
   - Snapshots are automatically saved into `draft_page_versions`.
4. **Draft-to-Document Finalization Pipeline**:
   - The user drafts and refines essays, statements, and resumes.
   - When finished, the user triggers **"Finalize Draft"** (`POST /api/v1/drafts/pages/:pageId/finalize`).
   - The server compiles TipTap JSON to HTML, renders a high-quality PDF using Puppeteer / Chromium, uploads it to S3, and creates an official record in Afaq's `documents` table while recording the milestone in `draft_page_versions`.
5. **Universal Notification Engine**: Wikso's notification service is adapted to Afaq's native `notifications` and `notification_types` tables.
6. **Registration Enhancements**: Dynamic registration kill-switch (`registration_enabled`), domain allowlisting (`allowed_email_domains`), and secure token-based invitations (`invitations`).
7. **Storage**: Direct integration with Afaq's existing `@aws-sdk/client-s3` pipeline.

---

## 2. Target Directory & Module Structure

The integrated features will be organized within `src/modules/` inside `Afaq-backend`:

```
src/modules/
├── auth/                    <-- Enhanced with invitation flow & domain allowlist checks
│   ├── dto/
│   │   ├── invite-user.dto.ts
│   │   └── accept-invite.dto.ts
│   └── invitations.service.ts
│
├── notifications/           <-- Ported universal notification module
│   ├── notifications.module.ts
│   ├── notifications.service.ts
│   ├── notifications.controller.ts
│   └── dto/
│
├── drafts/                  <-- Personal drafts & rich-text editor subsystem
│   ├── drafts.module.ts
│   ├── spaces/              (spaces.service.ts, spaces.controller.ts - scoped to user)
│   ├── pages/               (pages.service.ts, pages.controller.ts, REST auto-save)
│   ├── versions/            (versions.service.ts, version restore)
│   ├── attachments/         (attachments.service.ts, wired to Afaq AWS S3)
│   ├── tags/                (tags.service.ts, tags.controller.ts)
│   ├── templates/           (templates.service.ts, templates.controller.ts)
│   └── export/              (export.service.ts - Puppeteer HTML-to-PDF finalization engine)
│
└── ai-assistant/            <-- In-editor AI assistant & conversational writing copilot
    ├── ai-assistant.module.ts
    ├── ai-transform/        (inline text rewrite, grammar polish, expansion, summary)
    ├── ai-chat/             (multi-turn conversational assistant)
    └── providers/           (OpenAI, Anthropic Claude, Google Gemini registry)
```

---

## 3. Phase-by-Phase Execution Roadmap

### Phase 1: Database Migration & Schema Verification
* **Step 1.1**: Merge verified models from `docs/wikso-integration/integrated-schema.prisma` into `prisma/schema.prisma`.
* **Step 1.2**: Execute Prisma migration:
  ```bash
  pnpm prisma migrate dev --name add_drafts_ai_and_invitation_modules
  pnpm prisma:generate
  ```
* **Step 1.3**: Seed default `system_settings` records:
  * `auth.registration_enabled`: `true`
  * `auth.allowed_email_domains`: `[]`

### Phase 2: Core Dependencies Installation
* Install TipTap and PDF rendering dependencies:
  ```bash
  pnpm add @tiptap/core @tiptap/starter-kit @tiptap/pm @tiptap/html puppeteer-core @sparticuz/chromium
  ```
* Install AI SDK packages:
  ```bash
  pnpm add openai @anthropic-ai/sdk
  ```

### Phase 3: Notifications Engine Porting
* Implement `NotificationsModule` in `src/modules/notifications/`.
* Connect with Afaq's existing `notifications` and `notification_types` tables.
* Add REST endpoints for fetching notifications, unread counts, and marking as read.

### Phase 4: Personal Drafts & File Editor Module
* Implement `DraftsModule` in `src/modules/drafts/`:
  * **DraftSpacesService**: Manage user-scoped projects/folders (`@@unique([ownerId, slug])`).
  * **DraftPagesService**: Tree-structured documents, TipTap JSON handling, and REST auto-save with debounce.
  * **DraftVersionsService**: Automated snapshot creation on auto-save and version rollback.
  * **DraftAttachmentsService**: File upload pipeline linked to Afaq AWS S3.
  * **DraftTagsService & DraftTemplatesService**: Tagging taxonomy and CV/essay templates.

### Phase 5: Document Finalization & PDF Generation Pipeline
* Implement `DraftExportService`:
  * Convert TipTap JSON to semantic HTML.
  * Render high-resolution PDF via Puppeteer / Chromium.
  * Upload rendered PDF to AWS S3.
  * Create official record in `documents` table and link `documentId` with `isFinalizedSnapshot` in `draft_page_versions`.

### Phase 6: AI Writing Assistant Integration
* Implement `AiAssistantModule` in `src/modules/ai-assistant/`:
  * Transform endpoints: `POST /api/v1/editor/ai/edit`, `POST /api/v1/editor/ai/generate`.
  * Conversational chat: `POST /api/v1/editor/ai/chat` with `AiConversations` persistence.
  * Deferred billing limits per current decision.

### Phase 7: Registration Enhancements
* Implement `InvitationsService` in `src/modules/auth/`.
* Add pre-check hooks in `AuthService.register()` for `registration_enabled` and `allowed_email_domains`.

### Phase 8: Verification, Test Coverage & Postman Sync
* Unit and integration tests (target >= 80% coverage per `AGENTS.md`).
* Update `Levora_API.postman_collection.json` with all new endpoints.
* Verify TypeScript build: `pnpm build` and `pnpm lint`.
