# Implementation Plan: AI Assistant Architecture & Conversational Memory RAG

**Branch**: `011-ai-assistant-rag` | **Date**: 2026-10-18 | **Spec**: [specs/011-ai-assistant-rag/spec.md](spec.md)

**Input**: Feature specification from `/specs/011-ai-assistant-rag/spec.md`

---

## Summary

Implement an advanced conversational AI writing copilot for scholarship applicants, featuring:
1. **Conversational Memory RAG**: In-process, zero-cost 384-dimensional vector embedding generation via `@xenova/transformers` (`all-MiniLM-L6-v2`) and cosine similarity search via Supabase `pgvector` (`ai_message_embeddings`), eliminating token bloat while ensuring the assistant remembers long-term candidate facts.
2. **Delegated File-Editing Sub-Agent**: A stateless worker triggered via native Google Gemini tool calling (`propose_document_edit`), producing structured, reviewable edit proposals with an explicit database lifecycle (`PENDING`, `ACCEPTED`, `REJECTED`) and automatic draft version snapshots for instant rollback.
3. **Provider-Agnostic LLM Routing**: Native Google Gemini integration (`gemini-3.5-flash-lite`, `gemini-3.8-flash`) configured dynamically via `.env` (`GEMINI_MODEL`), complete with deterministic candidate profile context injection and offline fallback resilience.

---

## Technical Context

**Language/Version**: Node.js 20.x LTS, TypeScript 5.7+  
**Primary Framework**: NestJS 11.x  
**Primary Dependencies**:
- Local Vector Embeddings: `@xenova/transformers` (ONNX Runtime, `Xenova/all-MiniLM-L6-v2`)
- Cloud LLM Provider: Google Gemini Generative Language API (`v1beta` with tool calling), OpenAI SDK (`openai`), Anthropic SDK (`@anthropic-ai/sdk`)
- Database & Vector Storage: Prisma Client 6.x with Supabase `pgvector`
- Validation & Security: `class-validator`, `class-transformer`, `@nestjs/throttler`

**Storage**: Supabase PostgreSQL 17 with native `vector` extension (`vector(384)` with HNSW cosine distance index).  
**Testing**: Jest for unit/service tests (Arrange-Act-Assert); Supertest for HTTP controller integration tests.  
**Target Platform**: Linux (Ubuntu 22.04+ / container runtime).  
**Project Type**: Modular REST API backend application.  
**Performance Goals**:
- Local embedding generation: `< 25ms` per turn on standard CPU.
- Database vector cosine retrieval: `< 20ms` for top-2 semantic matches.
- End-to-end chat response: `< 3s` average model generation time.
- Zero added latency for user: Message embeddings generated asynchronously in background.

**Constraints**:
- **Zero Cloud Embedding Fees**: All vector embeddings generated locally in-process ($0.00 cost).
- **Synchronous REST**: Standard HTTP `200 OK` JSON responses (streaming deferred).
- **Zero Unauthorized Overwrites**: Draft pages are never mutated until candidate explicitly calls `/proposals/:id/accept`.
- **Automatic Rollback**: Every proposal acceptance automatically records an immutable version snapshot via `DraftVersionsService`.
- **Tenant Isolation**: Vector queries and proposal operations are strictly scoped to `req.user.id`.

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Constitution Mandate | Proposed Implementation Compliance | Status |
| :--- | :--- | :--- | :---: |
| **I. Architecture Boundaries** | `Controller → Service → Repository`. No business logic in controllers; no direct controller-to-controller calls. | Strict compliance. `AiChatController` and `AiProposalsController` only handle validation delegation and response envelopes. `AiAssistantService`, `AiMemoryService`, and `LocalEmbeddingService` encapsulate logic. | **PASS** |
| **II. Data Access & Persistence** | Prisma Client is single source of DB access. Repositories for complex queries. | All queries run through Prisma. Vector cosine search uses typed `$queryRaw` with documented architectural justification for `pgvector` operator (`<=>`). | **PASS** |
| **III. Schema & Migrations** | `prisma migrate dev` is single source of schema truth. Manual DDL forbidden. | New models (`AiMessageEmbedding`, `AiEditProposal`, `AiEditProposalStatus`) added to `prisma/schema.prisma` with automated migration. | **PASS** |
| **IV. Input Validation & DTOs** | Class-validator on all inputs with `whitelist: true, forbidNonWhitelisted: true`. All responses wrapped in unified envelope. | Strict class-validator DTOs (`AiChatDto`, `AiEditProposalDto`) with `@MaxLength(50000)` bounds and standard response envelope. | **PASS** |
| **V. Security & Config** | `@nestjs/config` for env variables; no hardcoded secrets; tenant isolation via JWT. | `GEMINI_API_KEY` and `GEMINI_MODEL` loaded via `ConfigService`. All endpoints guarded by `JwtAuthGuard` with `req.user.id` scoping. | **PASS** |
| **VI. Testing Standards** | Unit tests mandatory for all services; Given-When-Then structure; >=80% coverage. | Dedicated test suites planned for `GeminiProvider`, `LocalEmbeddingService`, `AiMemoryService`, and proposal state machines. | **PASS** |
| **VII. Quality Gates** | Clean `pnpm build`, clean `pnpm lint`, 100% test pass rate. | Feature delivery strictly gated by zero TypeScript errors and zero linter warnings. | **PASS** |

---

## Project Structure

### Documentation (this feature)

```text
specs/011-ai-assistant-rag/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical research & architectural decisions
├── data-model.md        # Prisma models, DTOs, and state machine
├── quickstart.md        # Verification scenarios & test run guide
├── contracts/           # Interface contracts
│   └── ai-chat-rag-api.yaml
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code Layout

```text
src/modules/ai-assistant/
├── ai-assistant.module.ts
├── ai-assistant.service.ts
├── ai-chat/
│   ├── ai-chat.controller.ts
│   └── ai-chat.controller.spec.ts
├── ai-transform/
│   ├── ai-transform.controller.ts
│   └── ai-transform.controller.spec.ts
├── ai-proposals/
│   ├── ai-proposals.controller.ts
│   ├── ai-proposals.controller.spec.ts
│   ├── dto/
│   │   ├── create-proposal.dto.ts
│   │   └── proposal-response.dto.ts
├── memory/
│   ├── local-embedding.service.ts
│   ├── local-embedding.service.spec.ts
│   ├── ai-memory.service.ts
│   └── ai-memory.service.spec.ts
├── providers/
│   ├── ai-provider.interface.ts
│   ├── gemini.provider.ts
│   ├── gemini.provider.spec.ts
│   ├── openai.provider.ts
│   └── anthropic.provider.ts
└── dto/
    ├── ai-chat.dto.ts
    ├── ai-edit.dto.ts
    └── ai-generate.dto.ts
```

---

## Implementation Phases

### Phase 1: Local Embedding Engine & Vector Schema
- Install `@xenova/transformers`.
- Implement `LocalEmbeddingService` with singleton initialization of `Xenova/all-MiniLM-L6-v2`.
- Update `prisma/schema.prisma` with `previewFeatures = ["postgresqlExtensions"]`, `AiMessageEmbedding`, `AiEditProposal`, and `AiEditProposalStatus`.
- Apply migration and configure HNSW cosine distance index in Supabase.

### Phase 2: Google Gemini Provider & Tool Calling
- Implement `GeminiProvider` with Google Generative Language API (`v1beta`).
- Configure dynamic model loading from `ConfigService` (`GEMINI_MODEL`, defaulting to `gemini-3.5-flash-lite`).
- Implement `propose_document_edit` function declaration in Gemini requests.
- Add unit tests for `GeminiProvider` including tool call parsing and mock fallback.

### Phase 3: Conversational Memory RAG & Profile Context
- Implement `AiMemoryService` for cosine similarity vector lookups and asynchronous background indexing.
- Integrate `AiMemoryService` and profile credential fetching into `AiAssistantService.chat`.
- Add unit tests for context assembly, memory injection, and tenant isolation.

### Phase 4: Staged Edit Proposals & Rollback Lineage
- Implement `AiProposalsController` with `/accept` and `/reject` endpoints.
- Wire proposal acceptance to `DraftVersionsService.createSnapshot()` and `DraftPagesService.saveContent()`.
- Add integration and controller unit tests verifying state transitions and immutable snapshot creation.

### Phase 5: Verification & End-to-End Validation
- Update Swagger API annotations and synchronize `Levora_API.postman_collection.json` with new AI endpoints.
- Run full test suite (`pnpm test`), clean lint (`pnpm lint`), and clean TypeScript build (`pnpm build`).
- Execute validation scenarios from `quickstart.md`.
