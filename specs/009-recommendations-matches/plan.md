# Implementation Plan: Recommendations Module

**Branch**: `009-recommendations-matches` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-recommendations-matches/spec.md`

---

## Summary

Add a new, separate `recommendations` NestJS module exposing two authenticated, read-only endpoints (`GET /api/v1/recommendations/matches` and `GET /api/v1/recommendations/matches-with-opportunities`). Match rows (`match_scores`) are pre-calculated by the external Python service and read from its PostgreSQL database through the existing `AiPrismaService` (read-only). The first endpoint never returns opportunity fields (it joins `cleaned_opportunities` for filtering only); the second adds a 7-field opportunity summary via the `opportunities` module's mapper. Filtering, sorting, pagination and caching are implemented once and shared. No recalculation endpoint (out of scope). No writes to the AI database.

---

## Technical Context

| Item | Value |
|:---|:---|
| **Language / Runtime** | TypeScript (strict) · Node.js ≥ 20 |
| **Framework** | NestJS 11 |
| **Primary Database** | PostgreSQL — main app DB (not touched by this feature; no migrations) |
| **External Database** | PostgreSQL — AI service DB (`DATABASE_AIService_URL`, read-only, no migrations from this repo) |
| **ORM / Query** | Prisma — existing AI client (`@prisma/ai-client`, `prisma/ai-schema.prisma`); add `MatchScore` model |
| **Validation** | `class-validator` + `class-transformer` (global `ValidationPipe`, `whitelist`, `forbidNonWhitelisted`) |
| **Auth** | Existing global JWT guard (`auth.guard.ts`); `@CurrentUser('id')` decorator for `user_id` |
| **Caching** | Existing global `CacheModule` (in-memory + Redis via Keyv); per-user keys; time-based TTL only |
| **Testing** | Jest (unit) · Jest + Supertest (E2E) |
| **Target Platform** | Linux server |
| **Project Type** | Web service — REST API (NestJS modular) |
| **Performance Goals** | SC-001: 95% of list requests < 1 s for ≤ 5,000 matches |
| **Constraints** | AI DB read-only · `limit` default 20, clamped to 100 · never return full opportunity details · identity only from token · 503 when AI DB unreachable |
| **Scale / Scope** | 1 new module · 2 endpoints · 1 service · 1 repository · shared DTO/mapper/filter · 1 small extraction in `opportunities` |

---

## Constitution Check

_GATE: Must pass before implementation._

| Rule (Constitution §) | Status | Notes |
|:---|:---:|:---|
| I. Controller → Service → Repository | ✅ | `RecommendationsController` → `RecommendationsService` → `RecommendationsRepository` → `AiPrismaService` |
| No business logic in Controllers | ✅ | Controller only parses DTO, reads `@CurrentUser('id')`, delegates |
| II. Complex joins in Repository | ✅ | Joins with `cleaned_opportunities` live in `RecommendationsRepository`; no `$queryRaw` |
| III. Schema & migrations | ✅ | No main-DB schema change. `ai-schema.prisma` only mirrors the Python-owned table (`prisma generate`, never `migrate`) |
| IV. DTO validation, uniform envelope, Swagger | ✅ | `ListMatchesDto`; `@ApiOperation/@ApiResponse/@ApiProperty` on both routes |
| V. Security & authorization | ✅ | Global JWT guard (no `@Public()`); `user_id` from token; user-scoped queries and cache keys; no ownership guard needed because the only owner is the token user and no resource id is accepted from the client |
| VI. Testing | ✅ | Unit + E2E per `quality-and-security.md` |
| VII. Quality gates | ✅ | `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` |
| VIII. Documentation | ✅ | Postman collection, `.env.example`, README, Swagger, sprint report |
| IX. Error handling & logging | ✅ | `ServiceUnavailableException`, `Logger`, `GlobalExceptionFilter` |
| X. Configuration | ✅ | New TTL settings read through `ConfigService` + zod schema; no `process.env` in services; TTLs are deployment/environment settings (not admin-tunable), so they stay in environment config and not in `SystemSettings` (recorded in DEC-REC-01) |
| XI. Module boundaries | ✅ | `recommendations` imports `OpportunitiesModule` and injects only the exported `OpportunitiesService` (public `buildWhere()`, `toBrief()`, `getBriefSelect()`); no repository/DTO imports across modules; `opportunities` knows nothing about matching; no circular dependency |

**Violations:** None. No Complexity Tracking required.

---

## Design Decisions (summary; details in [research.md](./research.md))

1. **Shared opportunity logic via public service methods** — refactor the inline `where` construction in `OpportunitiesService` into public `buildWhere(filters)`, and add public `toBrief()` and `getBriefSelect()`. `RecommendationsModule` imports `OpportunitiesModule` and uses only `OpportunitiesService` (Constitution XI). Behavior of feature 008 unchanged (its existing tests must still pass).
2. **One repository, two query shapes** — endpoint 1 uses `select` on match columns with a relation filter (`opportunity: { is: where }`); endpoint 2 adds `include: { opportunity: { select: <7 fields> } }`. `RecommendationsService` obtains the opportunity `where` and brief `select` from `OpportunitiesService` and passes them to the repository (the repository never imports the opportunities module).
3. **Expired/inactive rule** — applied as part of the opportunity relation `where` unless `include_expired=true`.
4. **Cache** — service-level `cache-manager` wrapper (not `@CacheInterceptor`, which cannot key on the JWT user safely); key `rec:{endpoint}:{userId}:{sha1(normalized filters)}`.
5. **Pagination** — reuse existing envelope `meta` (`page`, `limit`, `total`, `pages`) plus `synced_at`.

---

## Project Structure

### Documentation (this feature)

```text
specs/009-recommendations-matches/
├── spec.md
├── plan.md                  # This file
├── research.md
├── data-model.md
├── quickstart.md
├── endpoints.md
├── quality-and-security.md
├── contracts/
│   ├── list-matches.contract.md
│   └── list-matches-with-opportunities.contract.md
└── tasks.md                 # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
prisma/
└── ai-schema.prisma                         # + MatchScore model, + CleanedOpportunity.matchScores

src/
├── config/
│   └── recommendations.config.ts            # TTL settings (zod) ; registered in config/index.ts
├── modules/
│   ├── opportunities/
│   │   ├── opportunities.service.ts         # + public buildWhere(), toBrief(), getBriefSelect()
│   │   ├── opportunity-filter.types.ts      # NEW: OpportunityFilterInput interface
│   │   └── opportunities.module.ts          # already exports OpportunitiesService
│   └── recommendations/
│       ├── recommendations.module.ts
│       ├── recommendations.controller.ts
│       ├── recommendations.service.ts
│       ├── recommendations.repository.ts
│       ├── recommendations.mapper.ts        # single match mapper
│       ├── recommendations.constants.ts     # sort whitelist, inactive statuses, cache prefix
│       ├── dto/
│       │   ├── list-matches.dto.ts          # shared by both endpoints
│       │   └── match-response.dto.ts        # MatchDto, MatchWithOpportunityDto, meta
│       ├── recommendations.service.spec.ts
│       └── recommendations.mapper.spec.ts
└── app.module.ts                            # register RecommendationsModule

test/
└── recommendations.e2e-spec.ts

docx/decisions-log.md                        # DEC-REC-01 (written first): read-only match_scores access, env-based cache TTLs, public OpportunitiesService methods
Levora_API.postman_collection.json           # updated
.env.example / README.md                     # new TTL vars
```

**Structure Decision**: single new domain module under `src/modules/recommendations`, following the layout of `opportunities`. Only the two small extractions touch `opportunities`.

---

## Phases & Task Outline (input to `/speckit-tasks`)

1. **ADR first, then schema & config** — write DEC-REC-01 in `docx/decisions-log.md`; add `MatchScore` to `ai-schema.prisma`, run `pnpm generate:ai`; add `recommendations.config.ts`, `.env.example`, README.
2. **Opportunities service methods** — add public `buildWhere()`, `toBrief()`, `getBriefSelect()` to `OpportunitiesService` and refactor its inline logic; existing 008 tests stay green.
3. **Recommendations core** — constants, DTOs, mapper, repository (both query shapes, 503 mapping), service (cache + meta + `synced_at`).
4. **Controller & wiring** — two routes, Swagger (incl. "never returns full opportunity details"), register module.
5. **Tests** — unit (service, mapper, filter builder) and E2E (auth, validation, parity, isolation, 503).
6. **Docs** — Postman collection, sprint report in `docs/reports`.

---

## Open Items / Risks

| Item | Handling |
|:---|:---|
| Which `status` values mean "inactive" in `cleaned_opportunities` | Assumed list in `recommendations.constants.ts`; **confirm with AI-service team** (task T040, before T025) |
| Missing indexes on `match_scores` (`user_id, score_pct`, `user_id, calculated_at`) | Request from AI-service team (cannot be created from this repo) |
| `GET /opportunities?ids=` (frontend batch fetch) not present in 008 | Out of scope here; separate task in `opportunities` module |
| Read-only DB user must be granted `SELECT` on `match_scores` | Ops/AI-team dependency |
| Stale cache after recalculation (no invalidation) | Accepted by clarification; TTL kept modest |
