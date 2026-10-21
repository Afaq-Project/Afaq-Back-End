# Implementation Plan: Conversation Management

**Branch**: `012-conversation-management` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-conversation-management/spec.md`

---

## Summary

Deliver conversation management capabilities enabling candidates to browse their historical AI writing assistant sessions and reload chronological turn histories. The feature introduces two new read-only REST endpoints (`GET /editor/ai/conversations` and `GET /editor/ai/conversations/:conversationId/messages`) backed by existing PostgreSQL tables with zero database migrations. The implementation adheres strictly to NestJS modular domain boundaries (`AiConversationsController → AiAssistantService → PrismaService`) with strict multi-tenant ownership verification.

---

## Technical Context

**Language/Version**: TypeScript 5.9 | Node.js >= 20.0.0  
**Primary Dependencies**: NestJS 11.x (`@nestjs/common`, `@nestjs/swagger`), `class-validator`, `class-transformer`  
**Storage**: PostgreSQL 15 accessed via Prisma Client 6.x (`prisma.aiConversations`, `prisma.aiMessages`)  
**Testing**: Jest 29.x (`pnpm test`, `pnpm test:e2e`)  
**Target Platform**: Linux server / Node.js container  
**Project Type**: RESTful API Web Service  
**Performance Goals**: Response latency < 300ms p95 for conversation listing and message retrieval  
**Constraints**: Strict multi-tenant isolation (`where: { userId }`), pagination limit max 50, zero schema migrations  
**Scale/Scope**: 2 new endpoints, 1 new controller, ~3 DTOs, unit and E2E test suites  

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Requirement | Assessment | Result |
| :--- | :--- | :--- | :---: |
| **I. Architecture Boundaries** | Call flow `Controller → Service → Repository/Prisma`. Controllers contain no business logic. | `AiConversationsController` delegates strictly to `AiAssistantService`. | **PASS** |
| **II. Data Access** | Prisma is the single source of database access. | Uses standard `prisma.aiConversations` and `prisma.aiMessages` queries; no raw SQL needed. | **PASS** |
| **III. Schema & Migrations** | `prisma/schema.prisma` is the source of truth. | Reuses existing `AiConversations` and `AiMessages` models and indexes; zero migrations required. | **PASS** |
| **IV. Validation** | Request DTOs use `class-validator` and `forbidNonWhitelisted`. | `ListConversationsQueryDto` and `ParseUUIDPipe` enforce strict parameter validation. | **PASS** |
| **V. Error Handling** | Standardized response envelope and HTTP status codes via `GlobalExceptionFilter`. | Returns `200 OK` for data, `404 Not Found` for unowned/missing IDs, `401 Unauthorized` for missing token. | **PASS** |
| **VI. Testing** | Minimum 80% unit test coverage + E2E test suite. | Comprehensive unit tests for service and controller + integration E2E coverage. | **PASS** |
| **VII. Security** | Enforce authentication and multi-tenant authorization. | `JwtAuthGuard`, `@CurrentUser('id')`, compound Prisma query filter (`where: { id, userId }`). | **PASS** |

---

## Project Structure

### Documentation (`specs/012-conversation-management/`)

```text
specs/012-conversation-management/
├── spec.md              # Feature specification and clarifications
├── plan.md              # This implementation plan
├── research.md          # Phase 0: Architectural decisions and query patterns
├── data-model.md        # Phase 1: Entity schemas and DTO structures
├── quickstart.md        # Phase 1: Runnable validation and curl test guide
├── contracts/           # Phase 1: OpenAPI 3.0 specification
│   └── conversations-api.yaml
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (`src/modules/ai-assistant/`)

```text
src/modules/ai-assistant/
├── ai-conversations/
│   ├── ai-conversations.controller.ts       # Controller for /editor/ai/conversations
│   └── ai-conversations.controller.spec.ts  # Unit tests for controller
├── dto/
│   ├── conversation-pagination-query.dto.ts # Unified Query DTO (page, limit)
│   ├── conversation-summary.dto.ts          # Response DTO for conversation list
│   ├── conversation-messages-response.dto.ts# Response DTO for message list
│   └── index.ts                             # DTO barrel exports
├── ai-assistant.service.ts                  # Added listConversations & getConversationMessages
├── ai-assistant.service.spec.ts             # Service unit tests for new methods
└── ai-assistant.module.ts                   # Register AiConversationsController
```

**Structure Decision**: Added a distinct `ai-conversations` subfolder under `src/modules/ai-assistant/` following the existing module structure (`ai-chat/`, `ai-proposals/`, `ai-transform/`), ensuring separation of concerns while keeping AI assistant functionality cohesive.

---

## Complexity Tracking

> No constitution violations detected. Zero unnecessary abstractions or architectural overrides required.
