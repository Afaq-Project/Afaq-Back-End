# Research — Opportunity Browser

**Branch**: `008-opportunity-browser` | **Date**: 2026-09-30

All design decisions required to implement this feature are resolved below. No NEEDS CLARIFICATION items remain.

---

## Decision 1: Dual Prisma Client Strategy

**Decision**: Generate a second, isolated Prisma client from a separate schema file (`prisma/ai-schema.prisma`), with its output directed to `node_modules/@prisma/ai-client`. A dedicated `AiPrismaService` wraps this client's lifecycle (connect on init, disconnect on destroy) and is exported from a global `AiPrismaModule`.

**Rationale**:
- The main `schema.prisma` output cannot be overwritten — doing so would break all existing modules that import from `@prisma/client`.
- A custom output path (`generate --output ../node_modules/@prisma/ai-client`) is the officially supported Prisma pattern for multi-database setups in a single project.
- Wrapping the client in a NestJS service (rather than importing the raw client) respects the project's DI pattern, allows proper lifecycle management, and makes the client mockable in tests.
- A `@Global()` module is appropriate here because the AI client is an infrastructure-layer singleton needed by any module that queries AI data; it avoids re-importing `AiPrismaModule` in every consuming module.

**Alternatives Considered**:
- *Single schema with two datasources*: Prisma does not support multiple `datasource` blocks in one schema file. Rejected.
- *Raw `pg` client (no Prisma)*: Loses type safety and consistency with the project's existing ORM standard. Rejected.
- *Prisma `$queryRaw`*: Still requires an instantiated client; does not solve the dual-client problem. Rejected.

---

## Decision 2: Dynamic `select` Object Construction

**Decision**: Build the Prisma `select` object in the service layer from a validated, compile-time constant whitelist (`OPPORTUNITY_FIELD_WHITELIST`). If `fields=*`, expand to all 19 whitelist entries. If `fields` is absent on the list endpoint, use the 7-entry `OPPORTUNITY_DEFAULT_FIELDS` constant. Otherwise, split the comma-separated string, trim each entry, validate every entry against the whitelist (unknown → `400 INVALID_FIELD`), and build `{ [field]: true }` for each.

**Rationale**:
- Using a typed constant whitelist prevents any field outside the schema from reaching the Prisma select object, which guards against unintended data exposure.
- The whitelist is defined once and referenced by both the validation logic and the response shape, ensuring a single source of truth.
- Building `select` as `Record<string, true>` from the validated array is type-safe under Prisma's `Prisma.CleanedOpportunitySelect` when cast appropriately.

**Alternatives Considered**:
- *DTO-level `@IsIn()` on `fields`*: Cannot validate a comma-separated multi-value string at the DTO level cleanly. Service-layer validation is more appropriate. Rejected.
- *Always return all fields, let frontend filter*: Violates FR-011 and FR-014. Rejected.

---

## Decision 3: Dynamic `where` Clause Construction

**Decision**: Build the Prisma `where` object incrementally in the service: start with an empty object and conditionally add each clause only if the corresponding DTO value is defined and non-null. Use:
- `equals` for `country`, `opportunity_type`, `funding_type`, `source_id`, `is_remote`
- `gte` / `lte` on `deadline` for date range
- `hasSome` on `study_levels` and `fields_of_study` (Prisma array filter operator)
- `contains` with `mode: 'insensitive'` on `title` and `description`, wrapped in an `OR` clause for the `q` parameter

**Rationale**:
- Prisma's `where` object gracefully ignores `undefined` values, making incremental construction clean and readable without null-guard boilerplate.
- `hasSome` is the correct Prisma operator for "record array contains at least one of these values" — matches FR-004's OR-match requirement.
- `mode: 'insensitive'` provides case-insensitive substring matching on PostgreSQL without requiring raw SQL or custom extensions.

**Alternatives Considered**:
- *Trigram index + full-text search*: More performant at scale, but requires a database-level index on the AI service schema (which this service cannot control). The `contains` approach works correctly today and automatically benefits if the AI team adds a `pg_trgm` index later — see prior analysis in conversation. Deferred.
- *`startsWith` instead of `contains` for `q`*: Does not satisfy the "contains in title or description" requirement. Rejected.

---

## Decision 4: Error Mapping for External Database Failures

**Decision**: In both service methods (`findMany`, `findById`), wrap the Prisma call in a try/catch. Catch `PrismaClientInitializationError` (connection refused, unreachable host) and `PrismaClientKnownRequestError` with P1xxx error codes (connection lost mid-query). Map both to `ServiceUnavailableException` (HTTP 503) with the user-facing message `"Opportunity data source is currently unavailable"`. Log the original error with `Logger.error` (including the Prisma error code and message) at full verbosity for diagnostics. All other errors propagate to `GlobalExceptionFilter`.

**Rationale**:
- 503 is the semantically correct HTTP status for "the service cannot be reached right now" — it signals a transient, retryable condition to callers and gateway layers.
- Catching at the service layer (not a global filter) keeps the mapping logic close to the Prisma call and avoids leaking Prisma error details through the global filter.
- Logging at `Logger.error` level with full Prisma context satisfies SC-007 (failure logged with enough context for diagnosis) without exposing internals in the response body.

**Alternatives Considered**:
- *Retry once before failing*: Increases p95 latency significantly under outage conditions. Retry policy belongs at the infrastructure/load-balancer level. Rejected (confirmed by clarification Q4).
- *Let `GlobalExceptionFilter` catch Prisma errors*: The global filter cannot distinguish a Prisma connection error from an application bug without feature-specific knowledge. Service-layer catch is cleaner. Rejected.
- *Return 500*: Semantically incorrect for an external dependency failure. Rejected (confirmed by clarification Q4).

---

## Decision 5: `limit` Cap Enforcement

**Decision**: Enforce the 100-record cap in the service via `Math.min(dto.limit ?? 20, 100)`. No error is returned for over-limit values.

**Rationale**: Confirmed by clarification Q3. Silent clamping is user-friendly and avoids forcing clients to handle a recoverable condition as an error.

**Alternatives Considered**:
- *Reject with 400*: Adds friction for no security benefit on a read-only public endpoint. Rejected (clarification Q3).

---

## Decision 6: `fields` Whitelist Violation Behaviour

**Decision**: Any field name in the `fields` parameter that is not in `OPPORTUNITY_FIELD_WHITELIST` causes `BadRequestException` with error key `INVALID_FIELD`. No partial result is returned.

**Rationale**: Confirmed by clarification Q2. Failing loudly catches client integration bugs early and prevents silent data contract drift.

**Alternatives Considered**:
- *Silently drop unknown fields*: Masks client bugs. Rejected (clarification Q2).
