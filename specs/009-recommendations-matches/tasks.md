# Tasks: Recommendations Module

**Feature Branch**: `009-recommendations-matches`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)
**Contracts**: [contracts/](./contracts/) | **Endpoints**: [endpoints.md](./endpoints.md) | **Quality & Security**: [quality-and-security.md](./quality-and-security.md) | **Quickstart**: [quickstart.md](./quickstart.md)

---

## Multi-Agent Role Legend

| Label | Role | Constraint |
|:---:|:---|:---|
| `[EXEC]` | **Executor Agent** | Writes source code only. Never creates test files. |
| `[TEST]` | **Tester Agent** | Creates tests and reviews code only. Never modifies source files. |
| `[COORD]` | **Coordinator Agent** | Assigns tasks, verifies reports, confirms gates (`pnpm build`, `pnpm lint`, `pnpm test`). Never writes code or tests. |

Cycle per task group: `[COORD]` assigns → `[EXEC]` implements and reports (files, build, lint) → `[COORD]` verifies → `[TEST]` writes tests and reviews (EC/ST/FR refs) → `[COORD]` closes or sends fixes back to `[EXEC]`.

## Format: `- [ ] [ID] [P?] [Story?] [ROLE] Description with file path`

- **[P]**: parallelizable (different files, no dependency on incomplete tasks)
- **[US1–US3]**: user story label (US4 / recalculation was removed from scope)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema mirror, configuration, ADR. Blocks everything.

- [ ] T001 [EXEC] Add `MatchScore` model and `matchScores MatchScore[]` relation on `CleanedOpportunity` in `prisma/ai-schema.prisma` (per `data-model.md`), then run `pnpm generate:ai`
- [ ] T002 [P] [EXEC] Create `src/config/recommendations.config.ts` (zod: `RECOMMENDATIONS_MATCHES_CACHE_TTL_SEC` default 1800, `RECOMMENDATIONS_COMBINED_CACHE_TTL_SEC` default 300) and register it in `src/config/index.ts` and the `ConfigModule` load list in `src/app.module.ts`
- [ ] T003 [P] [EXEC] Add the two new variables to `.env.example` and document them in `README.md`
- [ ] T004 [P] [EXEC] Add ADR entry (read-only access to `match_scores`; shared filter/mapper extraction) in `docx/decisions-log.md` (or `docs/adr/`)
- [ ] T005 [COORD] Verify `pnpm generate:ai`, `pnpm build`, `pnpm lint` pass; confirm `.env.example` updated

**Checkpoint**: AI client exposes `matchScore`; config loads.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building blocks used by all stories. No story starts before this phase and its tester gate pass.

### Task Group 2-A — Extract shared opportunity logic (no behavior change to feature 008)

- [ ] T006 [EXEC] Create `src/modules/opportunities/opportunity-filter.builder.ts` exporting pure `buildOpportunityWhere(dto)` by moving the `where` construction out of `OpportunitiesService` (`src/modules/opportunities/opportunities.service.ts`); service now calls it
- [ ] T007 [P] [EXEC] Create `src/modules/opportunities/opportunity-brief.mapper.ts` exporting `BRIEF_OPPORTUNITY_SELECT` (7 fields) and `toBriefOpportunity()` (snake_case output)
- [ ] T008 [EXEC] Export both from `src/modules/opportunities/opportunities.module.ts` / module index (OpportunitiesModule must not import recommendations)
- [ ] T009 [TEST] Add `src/modules/opportunities/opportunity-filter.builder.spec.ts` and `opportunity-brief.mapper.spec.ts`; confirm existing `opportunities.service.spec.ts` and DTO specs still pass unchanged
- [ ] T010 [COORD] Verify 008 regression green, build and lint pass

### Task Group 2-B — Recommendations scaffold

- [ ] T011 [P] [EXEC] Create `src/modules/recommendations/recommendations.constants.ts` (`MATCH_SORT_WHITELIST`, `MATCH_SORT_TO_ORDER_BY`, `INACTIVE_OPPORTUNITY_STATUSES`, `MAX_LIMIT=100`, `DEFAULT_LIMIT=20`, cache prefixes)
- [ ] T012 [P] [EXEC] Create `src/modules/recommendations/dto/list-matches.dto.ts` (`page`, `limit`, `min_score`, `sort`, `calculated_after`, `include_expired`, plus opportunity filters reused from `ListOpportunitiesDto` minus `page/limit/sort/fields`; no `user_id`)
- [ ] T013 [P] [EXEC] Create `src/modules/recommendations/dto/match-response.dto.ts` (`MatchDto`, `BriefOpportunityDto`, `MatchWithOpportunityDto`, `MatchesMeta`) with `@ApiProperty`
- [ ] T014 [EXEC] Create `src/modules/recommendations/recommendations.mapper.ts` (single `toMatchDto()`; reuses `toBriefOpportunity`)
- [ ] T015 [EXEC] Create `src/modules/recommendations/recommendations.repository.ts` with `AiPrismaService`: `findMatches(userId, query)` (select 5 columns, relation filter `opportunity: { is }`, `count` in parallel, tiebreak `opportunityId asc`) and `findMatchesWithOpportunity(userId, query)` (adds `BRIEF_OPPORTUNITY_SELECT`); map Prisma init/`P1xxx` errors → `ServiceUnavailableException('SERVICE_UNAVAILABLE')`; build `where` including `calculated_after`, `min_score`, expired/inactive rule
- [ ] T016 [EXEC] Create `src/modules/recommendations/recommendations.module.ts` (imports `OpportunitiesModule`) and register `RecommendationsModule` in `src/app.module.ts`
- [ ] T017 [TEST] Create `src/modules/recommendations/recommendations.mapper.spec.ts` (match item has exactly 5 keys; brief reused; nulls preserved — EC-023, EC-024)
- [ ] T018 [COORD] Verify build, lint, circular-dependency free module load

**Checkpoint**: Module compiles and loads; no endpoints yet.

---

## Phase 3: User Story 1 — View my match scores (Priority: P1) 🎯 MVP

**Goal**: Authenticated user lists own matches (no opportunity fields) with pagination, `min_score`, sort, `calculated_after`, `synced_at`, caching, 503 handling.

**Independent Test**: Quickstart scenarios 1–4, 8–10.

### Task Group 3-A — Service, controller, caching

- [ ] T019 [US1] [EXEC] Implement `RecommendationsService.getMatches(userId, dto)` in `src/modules/recommendations/recommendations.service.ts`: clamp `limit`, capture `synced_at` before query, call repository, map, build `meta` (`page, limit, total, pages, synced_at`), cache via `CACHE_MANAGER` with key `rec:matches:{userId}:{sha1(normalized query)}` and `RECOMMENDATIONS_MATCHES_CACHE_TTL_SEC` (cache errors → `warn`, ignored)
- [ ] T020 [US1] [EXEC] Implement `RecommendationsController` `GET recommendations/matches` in `src/modules/recommendations/recommendations.controller.ts` using `@CurrentUser('id')`, no `@Public()`, Swagger decorators (state "does not return full opportunity details"), `@ApiBearerAuth()`
- [ ] T021 [US1] [EXEC] Validate `sort` against whitelist → `400 INVALID_SORT`; `min_score` 0–100; `calculated_after` ISO (in DTO/service)
- [ ] T022 [US1] [TEST] Create `src/modules/recommendations/recommendations.service.spec.ts` for US1: defaults, limit clamp, meta/`synced_at`, sort mapping, tiebreak, `min_score` boundaries (EC-001–EC-010, EC-015), cache hit/miss/TTL/per-user key/normalization/Redis-down (EC-028–EC-032), 503 mapping (EC-025)
- [ ] T023 [US1] [TEST] Create `test/recommendations.e2e-spec.ts` (matches endpoint): 401 without token, `user_id` rejected, cross-user isolation, no opportunity keys, empty list, page beyond last, validation errors (ST-001–ST-004, ST-009–ST-011, EC-034–EC-040)
- [ ] T024 [US1] [COORD] Verify `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` for US1

**Checkpoint**: MVP — default match list works end-to-end.

---

## Phase 4: User Story 2 — Filter matches by opportunity attributes (Priority: P2)

**Goal**: Reuse 008 filter semantics, expired/inactive hidden by default with `include_expired`.

**Independent Test**: Quickstart scenarios 5–6.

- [ ] T025 [US2] [EXEC] Wire `buildOpportunityWhere` + expired/inactive rule (`deadline IS NULL OR deadline >= now`, `status NOT IN INACTIVE_OPPORTUNITY_STATUSES`, skipped when `include_expired=true`) into the repository `where`; enforce `INVALID_DATE_RANGE` for `deadline_from > deadline_to`
- [ ] T026 [US2] [TEST] Extend `recommendations.service.spec.ts`: each filter, multi-filter AND, array OR-match, date-range error, expired/inactive default vs include, null deadline, orphan handling (EC-011–EC-014, EC-016–EC-020)
- [ ] T027 [US2] [TEST] Extend `test/recommendations.e2e-spec.ts`: filters change totals, no opportunity fields leak on filtered requests (EC-011), SQL-metacharacter `q` (ST-015)
- [ ] T028 [US2] [COORD] Verify gates for US2

---

## Phase 5: User Story 3 — Matches with brief opportunity info (Priority: P2)

**Goal**: Combined endpoint with 7-field summary, same inputs and results as the default endpoint.

**Independent Test**: Quickstart scenario 7.

- [ ] T029 [US3] [EXEC] Implement `RecommendationsService.getMatchesWithOpportunities(userId, dto)` (short TTL `RECOMMENDATIONS_COMBINED_CACHE_TTL_SEC`, key prefix `rec:combined`) in `src/modules/recommendations/recommendations.service.ts`
- [ ] T030 [US3] [EXEC] Add `GET recommendations/matches-with-opportunities` in `src/modules/recommendations/recommendations.controller.ts`; same DTO (so `fields` is rejected)
- [ ] T031 [US3] [TEST] Extend `recommendations.service.spec.ts`: combined shape, short TTL key separation, EC-021–EC-024
- [ ] T032 [US3] [TEST] Extend `test/recommendations.e2e-spec.ts`: parity of ordered ids with endpoint 1 for ≥ 3 filter sets, exactly 7 opportunity keys, `fields` rejected (ST-012)
- [ ] T033 [US3] [COORD] Verify gates for US3

---

## Phase 6: Polish & Cross-Cutting

- [ ] T034 [P] [TEST] Security tests ST-005–ST-008, ST-013, ST-014 (cache cross-user, static no-write scan, startup without `DATABASE_AIService_URL`, log secrecy, typed error surface) in `test/recommendations.e2e-spec.ts` / `recommendations.service.spec.ts`
- [ ] T035 [P] [EXEC] Update `Levora_API.postman_collection.json` with both endpoints (auth, sample params, expected responses)
- [ ] T036 [P] [EXEC] Add sprint report under `docs/reports/` (009-recommendations-matches) listing changes and task status
- [ ] T037 [EXEC] Add smoke entries for both endpoints to `tests/levora-smoke-tests.json`
- [ ] T038 [TEST] Verify coverage ≥ 80% for new services (`pnpm test:cov`); store report in `test-reports/<date>/`
- [ ] T039 [COORD] Run full gates (`pnpm build`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`) and walk through `quickstart.md`; confirm open items (inactive status values, SELECT grant, indexes) with AI team

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) and Phase 5 (US3) → Phase 6.
- US2 and US3 both extend the repository/service from US1; they can proceed in parallel once US1 is closed, but touch the same files (`recommendations.repository.ts`, `service.ts`, `controller.ts`) so merge sequentially if one agent set is used.
- Within Phase 1: T002, T003, T004 parallel after T001 is not required (independent files).
- Within Phase 2: T006 before T008; T007 parallel to T006; T011–T013 parallel; T014 needs T007, T013; T015 needs T001, T006, T007, T011, T012.

## Parallel Examples

- Phase 1: T002 ∥ T003 ∥ T004
- Phase 2-B: T011 ∥ T012 ∥ T013
- Phase 6: T034 ∥ T035 ∥ T036

## Implementation Strategy

1. **MVP**: Phases 1–3 (US1) — default match list, auth, caching, 503.
2. **Increment 1**: Phase 4 (filters + expired visibility).
3. **Increment 2**: Phase 5 (combined endpoint).
4. **Finish**: Phase 6 docs, Postman, coverage, full gates.

Each increment ends with a COORD gate; PRs stay under 400 changed lines (split per phase).
