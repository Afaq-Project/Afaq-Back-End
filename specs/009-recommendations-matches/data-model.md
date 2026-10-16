# Data Model: Recommendations Module

**Branch**: `009-recommendations-matches` | **Date**: 2026-10-07

No main-database changes. The only schema change mirrors a Python-owned table in `prisma/ai-schema.prisma` (client generation only — never migrated from this repo).

---

## Entities

### Match (`match_scores`, AI DB — read-only)

| Prisma field | DB column | Type | Notes |
|:---|:---|:---|:---|
| `id` | `id` | `uuid` PK | `gen_random_uuid()` |
| `userId` | `user_id` | `uuid` | No FK (users live in main DB) |
| `opportunityId` | `opportunity_id` | `uuid` | FK → `cleaned_opportunities.id` |
| `scorePct` | `score_pct` | `int` | 0–100 |
| `scoreBreakdown` | `score_breakdown` | `jsonb` | default `{}` |
| `calculationVersion` | `calculation_version` | `int` | default 1 |
| `calculatedAt` | `calculated_at` | `timestamp` | basis of incremental sync |
| `createdAt` | `created_at` | `timestamp` | not exposed |
| `updatedAt` | `updated_at` | `timestamp` | not exposed |

**Constraints**: `UNIQUE (user_id, opportunity_id)`.
**Not exposed**: `id`, `userId`, `createdAt`, `updatedAt`.

### Prisma addition (`prisma/ai-schema.prisma`)

```prisma
model MatchScore {
  id                 String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId             String             @map("user_id") @db.Uuid
  opportunityId      String             @map("opportunity_id") @db.Uuid
  opportunity        CleanedOpportunity @relation(fields: [opportunityId], references: [id])
  scorePct           Int                @map("score_pct")
  scoreBreakdown     Json               @default("{}") @map("score_breakdown")
  calculationVersion Int                @default(1) @map("calculation_version")
  calculatedAt       DateTime           @default(now()) @map("calculated_at")
  createdAt          DateTime           @default(now()) @map("created_at")
  updatedAt          DateTime           @updatedAt @map("updated_at")

  @@unique([userId, opportunityId])
  @@map("match_scores")
}
```

and on `CleanedOpportunity`: `matchScores MatchScore[]`.

### Brief Opportunity Summary (view of `cleaned_opportunities`, owned by `opportunities`)

`id`, `title`, `organization`, `deadline`, `country`, `opportunityType`, `isRemote` (serialized as snake_case in responses).

### User

Owned by the main DB; only its `id` (from the JWT) is used.

---

## Response Shapes (API)

| Shape | Fields |
|:---|:---|
| `MatchDto` | `opportunity_id`, `score_pct`, `score_breakdown`, `calculation_version`, `calculated_at` |
| `MatchWithOpportunityDto` | `MatchDto` + `opportunity: BriefOpportunityDto` |
| `BriefOpportunityDto` | `id`, `title`, `organization`, `deadline`, `country`, `opportunity_type`, `is_remote` |
| `MatchesMeta` | `page`, `limit`, `total`, `pages`, `synced_at` |

---

## Validation Rules

| Field | Rule |
|:---|:---|
| `min_score` | int, 0–100 |
| `sort` | one of `score_desc`, `score_asc`, `calculated_at_desc` |
| `calculated_after` | ISO 8601, strictly-after comparison on `calculated_at` |
| `include_expired` | boolean (string coerced), default `false` |
| `page` / `limit` | int ≥ 1; `limit` clamped to 100 |
| opportunity filters | identical to `ListOpportunitiesDto` (minus `page`, `limit`, `sort`, `fields`) |
| `user_id`, `fields`, unknown keys | rejected (`forbidNonWhitelisted`) |

---

## Relationships & Query Semantics

- `MatchScore.userId = token user` is always the first predicate.
- `MatchScore → CleanedOpportunity` many-to-one; opportunity filters and the expired/inactive rule apply through `opportunity: { is: {...} }`.
- Default ordering: `scorePct DESC, opportunityId ASC`.

## State Transitions

None — read-only; rows are created/updated by the Python service. Clients observe change through `calculated_at` + `synced_at`.

## Cache Keys

| Key | TTL (config) |
|:---|:---|
| `rec:matches:{userId}:{sha1(normalized query)}` | `RECOMMENDATIONS_MATCHES_CACHE_TTL_SEC` (default 1800) |
| `rec:combined:{userId}:{sha1(normalized query)}` | `RECOMMENDATIONS_COMBINED_CACHE_TTL_SEC` (default 300) |
