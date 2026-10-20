# Tasks: Personal Drafts & Document Editor Integration

**Input**: Design documents from `/specs/010-personal-drafts-editor/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  

---

## Format: `[ID] [P?] [Story] Description with exact file path`

- **[P]**: Can run in parallel (different files, no blocking dependencies).
- **[Story]**: User story identifier (`[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]`) mapping to `spec.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency installation and environment preparation.

- [ ] T001 Install rich-text and PDF export dependencies in package.json
- [ ] T002 [P] Install AI SDK dependencies in package.json
- [ ] T003 [P] Update environment configuration and documentation in .env.example and README.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema expansion, migrations, and universal notification engine.

**⚠️ CRITICAL**: Must be completed before any user story can begin.

- [ ] T004 Merge verified models from docs/wikso-integration/integrated-schema.prisma into prisma/schema.prisma
- [ ] T005 Add reverse relation fields to Users, Roles, and Documents in prisma/schema.prisma
- [ ] T006 Run Prisma migration to apply draft, AI, and invitation models in prisma/migrations/
- [ ] T007 [P] Create DTOs and interfaces for universal notifications in src/modules/notifications/dto/
- [ ] T008 [P] Implement NotificationsService in src/modules/notifications/notifications.service.ts
- [ ] T009 Implement NotificationsController in src/modules/notifications/notifications.controller.ts
- [ ] T010 Create NotificationsModule in src/modules/notifications/notifications.module.ts and register in src/app.module.ts
- [ ] T011 [P] Unit tests for NotificationsService in src/modules/notifications/notifications.service.spec.ts

**Checkpoint**: Database schema and notifications foundational layer ready.

---

## Phase 3: User Story 1 - Private Draft Workspace & Document Authoring (Priority: P1) 🎯 MVP

**Goal**: Enable candidates to create isolated private workspaces (`@@unique([ownerId, slug])`) and author rich-text documents with debounced REST auto-saving.

**Independent Test**: An authenticated user creates a workspace "Chevening 2026", creates "Statement of Purpose", saves formatted content via `PATCH`, and retrieves it intact with zero naming collisions.

- [ ] T012 [P] [US1] Create DraftSpaces DTOs in src/modules/drafts/spaces/dto/
- [ ] T013 [P] [US1] Create DraftPages DTOs in src/modules/drafts/pages/dto/
- [ ] T014 [US1] Implement DraftSpacesService with user-scoped slug isolation in src/modules/drafts/spaces/draft-spaces.service.ts
- [ ] T015 [US1] Implement DraftSpacesController in src/modules/drafts/spaces/draft-spaces.controller.ts
- [ ] T016 [US1] Implement DraftPagesService with REST auto-save in src/modules/drafts/pages/draft-pages.service.ts
- [ ] T017 [US1] Implement DraftPagesController in src/modules/drafts/pages/draft-pages.controller.ts
- [ ] T018 [P] [US1] Implement DraftAttachmentsService for S3 media in src/modules/drafts/attachments/draft-attachments.service.ts
- [ ] T019 [US1] Implement DraftAttachmentsController in src/modules/drafts/attachments/draft-attachments.controller.ts
- [ ] T020 [P] [US1] Implement DraftTagsService in src/modules/drafts/tags/draft-tags.service.ts
- [ ] T021 [P] [US1] Implement DraftTemplatesService in src/modules/drafts/templates/draft-templates.service.ts
- [ ] T022 [US1] Assemble and export DraftsModule in src/modules/drafts/drafts.module.ts
- [ ] T023 [P] [US1] Unit tests for DraftSpacesService in src/modules/drafts/spaces/draft-spaces.service.spec.ts
- [ ] T024 [P] [US1] Unit tests for DraftPagesService in src/modules/drafts/pages/draft-pages.service.spec.ts

**Checkpoint**: User Story 1 (MVP) is fully functional and testable independently.

---

## Phase 4: User Story 2 - In-Editor AI Writing Assistant (Priority: P2)

**Goal**: Provide candidates with contextual inline text transformations (rephrase, grammar check, tone adjustment) and multi-turn writing copilot assistance.

**Independent Test**: Highlight text in a draft, invoke `/api/v1/editor/ai/edit` with `academic_tone`, and receive a polished suggestion; converse with the writing copilot via `/api/v1/editor/ai/chat`.

- [ ] T025 [P] [US2] Create DTOs for AI edit and chat in src/modules/ai-assistant/dto/
- [ ] T026 [P] [US2] Define AiProvider interface in src/modules/ai-assistant/providers/ai-provider.interface.ts
- [ ] T027 [P] [US2] Implement OpenAiProvider adapter in src/modules/ai-assistant/providers/openai.provider.ts
- [ ] T028 [P] [US2] Implement AnthropicProvider adapter in src/modules/ai-assistant/providers/anthropic.provider.ts
- [ ] T029 [US2] Implement AiAssistantService with prompt templates in src/modules/ai-assistant/ai-assistant.service.ts
- [ ] T030 [US2] Implement AiTransformController in src/modules/ai-assistant/ai-transform/ai-transform.controller.ts
- [ ] T031 [US2] Implement AiChatController with conversation memory in src/modules/ai-assistant/ai-chat/ai-chat.controller.ts
- [ ] T032 [US2] Assemble and export AiAssistantModule in src/modules/ai-assistant/ai-assistant.module.ts
- [ ] T033 [P] [US2] Unit tests for AiAssistantService in src/modules/ai-assistant/ai-assistant.service.spec.ts

**Checkpoint**: User Stories 1 AND 2 operate independently and together.

---

## Phase 5: User Story 3 - Version History & Document Rollback (Priority: P3)

**Goal**: Automatically record chronological revision snapshots on auto-save milestones and allow preview and one-click rollback.

**Independent Test**: Make multiple edits to a draft, inspect the version timeline via `GET /versions`, and revert to an earlier snapshot via `POST /revert`.

- [ ] T034 [P] [US3] Create DraftVersions DTOs in src/modules/drafts/versions/dto/
- [ ] T035 [US3] Implement DraftVersionsService with automated snapshots in src/modules/drafts/versions/draft-versions.service.ts
- [ ] T036 [US3] Implement DraftVersionsController for timeline and rollback in src/modules/drafts/versions/draft-versions.controller.ts
- [ ] T037 [US3] Integrate automated version snapshot creation into DraftPagesService auto-save hook in src/modules/drafts/pages/draft-pages.service.ts
- [ ] T038 [P] [US3] Unit tests for DraftVersionsService in src/modules/drafts/versions/draft-versions.service.spec.ts

**Checkpoint**: Versioning and rollback operational without impacting active editing latency.

---

## Phase 6: User Story 4 - Document Finalization & Official Lineage Tracking (Priority: P4)

**Goal**: Compile completed draft into an official high-resolution PDF, upload to AWS S3, record in Afaq's native `documents` table, update profile to make it the active/approved version, lock draft in read-only `FINALIZED` state, and support unlock for new revisions.

**Independent Test**: Finalize a completed draft, verify PDF file exists in S3, verify entry in `documents`, observe draft locked in read-only mode, unlock draft, and verify re-finalization generates a new versioned file without destroying the previous record.

- [ ] T039 [P] [US4] Create DraftFinalizeDto in src/modules/drafts/export/dto/draft-finalize.dto.ts
- [ ] T040 [US4] Implement DraftExportService for HTML-to-PDF compilation via Puppeteer in src/modules/drafts/export/draft-export.service.ts
- [ ] T041 [US4] Implement S3 upload and base documents record creation in src/modules/drafts/export/draft-export.service.ts
- [ ] T042 [US4] Implement profile active/approved document update and read-only FINALIZED state transition in src/modules/drafts/export/draft-export.service.ts
- [ ] T043 [US4] Implement DraftExportController with finalize and unlock endpoints in src/modules/drafts/export/draft-export.controller.ts
- [ ] T044 [P] [US4] Unit tests for DraftExportService in src/modules/drafts/export/draft-export.service.spec.ts

**Checkpoint**: Full end-to-end bridge between personal drafts and official profile application documents.

---

## Phase 7: User Story 5 - Controlled Onboarding via Invitations (Priority: P5)

**Goal**: Provide administrators with single-use, time-limited tokenized invitation links and enforce platform registration controls.

**Independent Test**: Issue an invitation token via admin endpoint, pause public registration, and verify only candidates with valid tokens can complete signup.

- [ ] T045 [P] [US5] Create Invitations DTOs in src/modules/auth/dto/
- [ ] T046 [US5] Implement InvitationsService with SHA-256 token hashing in src/modules/auth/invitations.service.ts
- [ ] T047 [US5] Implement InvitationsController for admin issuance in src/modules/auth/invitations.controller.ts
- [ ] T048 [US5] Integrate registration_enabled and allowed_email_domains validation into AuthService.register in src/modules/auth/auth.service.ts
- [ ] T049 [P] [US5] Unit tests for InvitationsService in src/modules/auth/invitations.service.spec.ts

**Checkpoint**: Controlled onboarding and institutional invitation subsystem operational.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: API documentation, seed data, linting, and end-to-end verification.

- [ ] T050 [P] Update Levora_API.postman_collection.json with all new draft, AI, notification, and invitation endpoints
- [ ] T051 [P] Seed default system_settings and baseline notification_types in prisma/seed.ts
- [ ] T052 Verify TypeScript build and formatting: run pnpm build and pnpm lint --fix
- [ ] T053 Execute full test suite ensuring >=80% coverage and asserting latency thresholds (auto-save < 200ms, PDF export < 10s): pnpm test
- [ ] T054 Execute end-to-end quickstart validation scenarios per specs/010-personal-drafts-editor/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies
1. **Setup (Phase 1)**: Can begin immediately.
2. **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all User Stories**.
3. **User Stories (Phases 3–7)**:
   - **User Story 1 (P1)**: Starts after Phase 2 (Core MVP).
   - **User Story 2 (P2)**: Can proceed after Phase 2 in parallel with or after US1.
   - **User Story 3 (P3)**: Builds on US1 draft pages to add snapshots and rollback.
   - **User Story 4 (P4)**: Builds on US1 and US3 to finalize drafts into official documents.
   - **User Story 5 (P5)**: Independent auth enhancement, can execute anytime after Phase 2.
4. **Polish (Phase 8)**: Depends on all desired user stories being completed.

---

## Parallel Execution Examples

```bash
# Foundational DTOs and Services (Phase 2):
T007 [P] Create DTOs and interfaces for universal notifications
T008 [P] Implement NotificationsService

# User Story 1 DTOs and Sub-services (Phase 3):
T012 [P] [US1] Create DraftSpaces DTOs
T013 [P] [US1] Create DraftPages DTOs
T018 [P] [US1] Implement DraftAttachmentsService
T020 [P] [US1] Implement DraftTagsService
T021 [P] [US1] Implement DraftTemplatesService

# User Story 2 Providers (Phase 4):
T027 [P] [US2] Implement OpenAiProvider adapter
T028 [P] [US2] Implement AnthropicProvider adapter
```

---

## Implementation Strategy: MVP First

1. **Step 1**: Complete Phase 1 (Setup) and Phase 2 (Foundational DB migration).
2. **Step 2**: Deliver Phase 3 (User Story 1 - Personal Drafts MVP).
3. **Step 3**: Validate User Story 1 independently with live auto-save cURL requests.
4. **Step 4**: Layer User Story 2 (AI Assistant), User Story 3 (Version History), and User Story 4 (PDF Finalization) incrementally.
