# Implementation Plan: Personal Drafts & Document Editor Integration

**Branch**: `010-personal-drafts-editor` | **Date**: 2026-10-17 | **Spec**: [specs/010-personal-drafts-editor/spec.md](spec.md)

**Input**: Feature specification from `/specs/010-personal-drafts-editor/spec.md`

---

## Summary

Integrate a secure, user-scoped personal rich-text document drafting subsystem (Personal Drafts/Editor), an in-editor AI writing assistant, an automated version snapshot engine, and an official document finalization pipeline into `Afaq-backend`. The architecture replaces collaborative wiki clutter with a private, candidate-centric drafting workflow, preserving Afaq's existing 32 base tables 100% intact while establishing clean lineage between editable drafts and official application documents (`documents` table) rendered as high-fidelity PDFs.

---

## Technical Context

**Language/Version**: Node.js 20.x LTS, TypeScript 5.7+  
**Primary Framework**: NestJS 11.x  
**Primary Dependencies**:
- Editor & Rich Text: `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/pm`, `@tiptap/html`
- PDF Rendering Engine: `puppeteer-core`, `@sparticuz/chromium`
- AI SDKs: `openai`, `@anthropic-ai/sdk`
- File Storage: `@aws-sdk/client-s3` (existing Afaq S3 pipeline)
- Cryptography & Hashing: `bcrypt`, Node.js native `crypto` (SHA-256 for invitation tokens)

**Storage**: PostgreSQL 16+ via Prisma ORM 6.x; AWS S3 for embedded draft attachments and finalized PDF assets.  
**Testing**: Jest for unit and service tests (Arrange-Act-Assert); Supertest for HTTP controller integration tests.  
**Target Platform**: Linux (Ubuntu 22.04+ / Alpine container runtime).  
**Project Type**: Modular REST API backend application.  
**Performance Goals**:
- REST Auto-save round-trip latency: `< 200ms` p95.
- Inline AI transformation generation: `< 3s` average response.
- HTML-to-PDF compilation & S3 persistence: `< 5s` for documents up to 20 pages.

**Constraints**:
- **Zero WebSockets / No CRDTs**: Exclusively standard HTTP `PATCH` REST auto-saving.
- **Base Table Immutability**: No columns, tables, or relations in Afaq's existing 32 base models may be altered.
- **Strict Privacy**: Workspaces and drafts are isolated per user (`@@unique([ownerId, slug])`).
- **Test Coverage**: Minimum 80% line/branch coverage across all newly introduced services per `AGENTS.md`.

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Constitution Mandate | Proposed Implementation Compliance | Status |
| :--- | :--- | :--- | :---: |
| **I. Architecture Boundaries** | `Controller → Service → Repository`. No business logic in controllers; no direct controller-to-controller calls. | Strict adherence. Controllers handle DTO validation (`ValidationPipe`) and route dispatching. Services encapsulate business rules, auto-save logic, and AI orchestration. Data queries encapsulate through Prisma services and repositories. | **PASS** |
| **II. Data Access & Persistence** | Prisma Client is single source of DB access. Repositories for complex queries. | All database persistence runs through Prisma 6 Client. Repositories implemented for hierarchical draft trees and version rollbacks. | **PASS** |
| **III. Schema & Migrations** | `prisma migrate dev` is single source of schema truth. Manual DDL forbidden. | All 11 new models are merged into `prisma/schema.prisma` via a dedicated migration (`add_drafts_ai_and_invitation_modules`). Base tables untouched. | **PASS** |
| **IV. Input Validation & DTOs** | Class-validator on all inputs with `whitelist: true, forbidNonWhitelisted: true`. | All incoming payloads (Draft creation, PATCH auto-save, AI prompts, invitations) strictly typed with class-validator DTOs. | **PASS** |
| **V. Security & Config** | `@nestjs/config` for env variables; no hardcoded secrets; bcrypt for passwords. | AI API keys and S3 credentials read strictly from `ConfigService`. Invitation tokens stored as SHA-256 hashes. | **PASS** |
| **VI. Testing Standards** | Jest unit tests mandatory for all services; Given-When-Then structure; >=80% coverage. | Comprehensive test suites planned for `DraftsService`, `DraftExportService`, `AiAssistantService`, and `InvitationsService`. | **PASS** |

---

## Project Structure

### Documentation (this feature)

```text
specs/010-personal-drafts-editor/
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 technical research & decisions
├── data-model.md        # Phase 1 domain entity specifications
├── quickstart.md        # Phase 1 runnable validation guide
├── contracts/           # Phase 1 REST OpenAPI / HTTP contracts
│   ├── drafts-api.yaml
│   ├── ai-api.yaml
│   ├── notifications-api.yaml
│   └── invitations-api.yaml
└── checklists/
    └── requirements.md  # Quality validation checklist
```

### Source Code (repository root)

```text
src/
├── modules/
│   ├── auth/                    # Enhanced registration pipeline
│   │   ├── dto/
│   │   │   ├── invite-user.dto.ts
│   │   │   └── accept-invite.dto.ts
│   │   ├── invitations.controller.ts
│   │   └── invitations.service.ts
│   │
│   ├── notifications/           # Universal notification engine
│   │   ├── notifications.module.ts
│   │   ├── notifications.controller.ts
│   │   ├── notifications.service.ts
│   │   └── dto/
│   │
│   ├── drafts/                  # Personal drafts & editor subsystem
│   │   ├── drafts.module.ts
│   │   ├── spaces/              # User-scoped workspaces (folders/projects)
│   │   │   ├── draft-spaces.controller.ts
│   │   │   └── draft-spaces.service.ts
│   │   ├── pages/               # Rich-text documents & REST auto-save
│   │   │   ├── draft-pages.controller.ts
│   │   │   └── draft-pages.service.ts
│   │   ├── versions/            # Snapshot history & rollback
│   │   │   ├── draft-versions.controller.ts
│   │   │   └── draft-versions.service.ts
│   │   ├── attachments/         # Embedded media uploads (AWS S3)
│   │   │   ├── draft-attachments.controller.ts
│   │   │   └── draft-attachments.service.ts
│   │   ├── templates/           # CV & personal statement blueprints
│   │   │   ├── draft-templates.controller.ts
│   │   │   └── draft-templates.service.ts
│   │   ├── tags/                # Organization tags
│   │   │   ├── draft-tags.controller.ts
│   │   │   └── draft-tags.service.ts
│   │   └── export/              # Finalization engine (HTML -> PDF -> S3 -> documents)
│   │       ├── draft-export.controller.ts
│   │       └── draft-export.service.ts
│   │
│   └── ai-assistant/            # In-editor AI writing copilot
│       ├── ai-assistant.module.ts
│       ├── ai-transform/        # Rewrite, shorten, expand, grammar polish
│       │   ├── ai-transform.controller.ts
│       │   └── ai-transform.service.ts
│       ├── ai-chat/             # Conversational writing copilot
│       │   ├── ai-chat.controller.ts
│       │   └── ai-chat.service.ts
│       └── providers/           # OpenAI & Anthropic integration adapters
│           ├── ai-provider.interface.ts
│           ├── openai.provider.ts
│           └── anthropic.provider.ts
```

**Structure Decision**: Standard NestJS domain modular structure in `src/modules/` matching existing Afaq conventions (`auth`, `opportunities`, `users`, `profile`).

---

## Complexity Tracking

> **No Constitution Violations detected.** All patterns strictly align with `AGENTS.md` and `.specify/memory/constitution.md`.
