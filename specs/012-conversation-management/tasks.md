# Tasks: Conversation Management

**Input**: Design documents from `/specs/012-conversation-management/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/conversations-api.yaml`  

---

## Phase 1: Setup

**Purpose**: Scaffolding directories and module structure

- [ ] T001 Create controller directory in `src/modules/ai-assistant/ai-conversations/`
- [ ] T002 [P] Create and configure index barrel export file in `src/modules/ai-assistant/dto/index.ts` for all new conversation DTOs

---

## Phase 2: Foundational (DTOs & Validation)

**Purpose**: Shared Data Transfer Objects and validation schemas for query and response payloads

- [ ] T003 [P] Implement unified `ConversationPaginationQueryDto` (with `ListConversationsQueryDto` alias) with pagination validation (`page`, `limit`) in `src/modules/ai-assistant/dto/conversation-pagination-query.dto.ts`
- [ ] T004 [P] Implement `ConversationSummaryDto` and list response container in `src/modules/ai-assistant/dto/conversation-summary.dto.ts`
- [ ] T005 [P] Implement `ConversationMessageItemDto` and message history response container in `src/modules/ai-assistant/dto/conversation-messages-response.dto.ts`

**Checkpoint**: Foundation ready — user story implementation can proceed.

---

## Phase 3: User Story 1 - View List of Past Conversations (Priority: P1) 🎯 MVP

**Goal**: Authenticated candidates can retrieve a paginated list of their own conversation sessions sorted by recent activity with titles, dates, message counts, and latest message previews.

**Independent Test**: Send authenticated `GET /api/v1/editor/ai/conversations?page=1&limit=20` and assert 200 OK with correct summary shape and metadata.

### Tests for User Story 1
- [ ] T006 [P] [US1] Unit test `listConversations` query, sorting, pagination, and preview truncation in `src/modules/ai-assistant/ai-assistant.service.spec.ts`
- [ ] T007 [P] [US1] Unit test `GET /editor/ai/conversations` controller route and guard enforcement in `src/modules/ai-assistant/ai-conversations/ai-conversations.controller.spec.ts`

### Implementation for User Story 1
- [ ] T008 [US1] Implement `listConversations(userId, pagination)` in `src/modules/ai-assistant/ai-assistant.service.ts` using single-query inclusion for `_count` and latest message snippet
- [ ] T009 [US1] Implement `listConversations` endpoint with `@CurrentUser('id')` and `@UseGuards(JwtAuthGuard)` in `src/modules/ai-assistant/ai-conversations/ai-conversations.controller.ts`
- [ ] T010 [US1] Register `AiConversationsController` in `src/modules/ai-assistant/ai-assistant.module.ts`

**Checkpoint**: User Story 1 is functional and independently testable (MVP complete).

---

## Phase 4: User Story 2 - Resume and View Selected Conversation History (Priority: P1)

**Goal**: Authenticated candidates can select an existing conversation session and load its chronological message history (`oldest to newest`) with strict tenant isolation.

**Independent Test**: Send authenticated `GET /api/v1/editor/ai/conversations/:conversationId/messages` and verify 200 OK with chronological turns, or 404 Not Found if unowned.

### Tests for User Story 2
- [ ] T011 [P] [US2] Unit test `getConversationMessages` with chronological ordering and cross-user isolation in `src/modules/ai-assistant/ai-assistant.service.spec.ts`
- [ ] T012 [P] [US2] Unit test `GET /editor/ai/conversations/:conversationId/messages` controller handler in `src/modules/ai-assistant/ai-conversations/ai-conversations.controller.spec.ts`

### Implementation for User Story 2
- [ ] T013 [US2] Implement `getConversationMessages(userId, conversationId, pagination)` in `src/modules/ai-assistant/ai-assistant.service.ts` returning 404 for missing or unowned sessions
- [ ] T014 [US2] Implement `getConversationMessages` endpoint with `ParseUUIDPipe` in `src/modules/ai-assistant/ai-conversations/ai-conversations.controller.ts`

**Checkpoint**: User Stories 1 and 2 are functional together.

---

## Phase 5: User Story 3 - Start a New Clean Conversation Session (Priority: P2)

**Goal**: Ensure clean session initiation and seamless transition when starting new conversations without carry-over context.

**Independent Test**: Initiate chat without `conversationId`, verify new conversation ID returned, and verify it immediately appears at the top of `listConversations`.

### Tests for User Story 3
- [ ] T015 [P] [US3] Unit test in `src/modules/ai-assistant/ai-assistant.service.spec.ts` asserting clean session initialization immediately reflected in `listConversations`

### Implementation for User Story 3
- [ ] T016 [US3] Verify and document client clean session handoff in `src/modules/ai-assistant/ai-assistant.service.ts`

**Checkpoint**: All three user stories are complete and integrated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Integration testing, API documentation verification, and quality gates

- [ ] T017 [P] Implement E2E integration test suite for conversations API in `test/ai-conversations.e2e-spec.ts`
- [ ] T018 Swagger OpenAPI metadata annotations alignment in `src/modules/ai-assistant/ai-conversations/ai-conversations.controller.ts`
- [ ] T019 Run automated quickstart scenarios from `specs/012-conversation-management/quickstart.md`
- [ ] T020 Run linter and typecheck via `pnpm lint` and `pnpm build`

---

## Dependencies & Execution Order

### Phase Dependencies
1. **Setup (Phase 1)**: No dependencies.
2. **Foundational (Phase 2)**: Depends on Phase 1 — blocks all user stories.
3. **User Story 1 (Phase 3)**: Depends on Phase 2.
4. **User Story 2 (Phase 4)**: Depends on Phase 2; can execute in parallel with or sequentially after US1.
5. **User Story 3 (Phase 5)**: Depends on Phase 3 and Phase 4.
6. **Polish (Phase 6)**: Depends on all user story phases completion.

### Parallel Opportunities
* T003, T004, T005 can be implemented in parallel.
* T006, T007 (US1 unit tests) can be written in parallel.
* T011, T012 (US2 unit tests) can be written in parallel.
* T017 (E2E tests) can be authored in parallel with Phase 5 implementation.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational DTOs).
2. Complete Phase 3 (User Story 1: Listing conversations).
3. Validate `GET /editor/ai/conversations` with unit tests.
4. Deliver working MVP list endpoint.

### Incremental Delivery
1. Foundation & US1 → Users can browse conversation list.
2. Add US2 → Users can resume and view message history of selected thread.
3. Add US3 & Polish → Full clean session lifecycle, E2E tests, and documentation.
