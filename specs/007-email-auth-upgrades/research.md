# Research: Email Module & Auth Upgrades

**Feature**: 007-email-auth-upgrades
**Date**: 2026-09-29
**Branch**: `007-email-auth-upgrades`

---

## R1 — @nestjs-modules/mailer + Handlebars Integration

**Decision**: Create a dedicated `src/modules/mail/mail.module.ts` marked `@Global()`, configured with `MailerModule.forRootAsync()` injecting `ConfigService`. Templates live at `src/modules/mail/templates/`. The module exports `MailService` so any consuming module can import `MailModule` and inject `MailService` without touching SMTP config.

**Key config shape**:
```
transport: { host, port, secure, auth: { user, pass } }
defaults: { from: "\"Levora\" <no-reply@levora.app>" }
template: { dir: path.join(__dirname, 'templates'), adapter: HandlebarsAdapter, options: { strict: true } }
```

**Template files** (Handlebars `.hbs`):
- `verify-email.hbs` — link + expiry info
- `reset-password.hbs` — link + expiry info

**Development interception**: `MAIL_PREVIEW=true` env flag switches transport to a local Mailpit/Ethereal endpoint using the same config shape — no code change required.

**Rationale**: `@Global()` avoids re-importing MailModule in every consuming module. `forRootAsync` respects the constitution's ConfigService-only rule for secrets.

**Alternatives considered**:
- Inline in `app.module.ts`: Rejected — violates single-responsibility; templates would have no clear home.
- Nodemailer direct: Rejected — higher boilerplate, no template adapter abstraction.

---

## R2 — Redis-Backed Ephemeral Token Storage

**Decision**: Mirror the existing refresh token namespace pattern. Store tokens under two keys per user:

| Key Pattern | Type | TTL | Purpose |
|:---|:---|:---|:---|
| `vt:{userId}:{sha256(rawToken)}` | String | 24h | Verification token existence check |
| `vt:current:{userId}` | String | 24h | Hash of the current active token (for single-token-per-user enforcement) |
| `prt:{userId}:{sha256(rawToken)}` | String | 1h | Password-reset token existence check |
| `prt:current:{userId}` | String | 1h | Hash of the current active reset token |

**Single-use + supersede logic (atomic pipeline)**:
1. `GET vt:current:{userId}` → get old hash
2. `DEL vt:{userId}:{oldHash}` (if exists)
3. `SET vt:{userId}:{newHash} "1" EX 86400`
4. `SET vt:current:{userId} {newHash} EX 86400`

All four operations executed in a single Redis `multi()` pipeline to prevent race conditions.

**Rationale**: Consistent with existing `rt:{userId}:{hash}` + `rt:user:{userId}` pattern. The `current` pointer enables O(1) previous-token invalidation without scanning. Raw token never stored — only SHA-256 hash at rest.

**Alternatives considered**:
- PostgreSQL table: Rejected — ephemeral data; adds schema churn for short-lived records.
- Single key with token as value: Rejected — no O(1) existence check for the token hash.

---

## R3 — Prisma Schema: passwordResetRequired Flag

**Decision**: Add two fields to the `Users` model in `prisma/schema.prisma`:

```prisma
passwordResetRequired   Boolean   @default(false) @map("password_reset_required")
passwordResetRequiredAt DateTime? @map("password_reset_required_at") @db.Timestamptz(6)
```

No index required: The field is read at login time via a `findUnique` on `email` (already indexed). Adding a partial index (`WHERE password_reset_required = true`) would be premature optimisation at this scale.

**Migration command**: `npx prisma migrate dev --name add_password_reset_required_to_users`

**Clearing the flag**: Set both fields back to `false` / `null` when the user completes a successful password reset via the standard reset flow.

**Rationale**: DB persistence is required (survives server restarts; auditable via `passwordResetRequiredAt`). Redis would be lost on flush/restart, leaving users unable to reset.

**Alternatives considered**:
- Redis-only flag: Rejected — not durable across restarts.
- Separate `forced_resets` table: Rejected — over-engineered; the flag + timestamp on the user row are sufficient for this spec's scope.

---

## R4 — Per-Email Rate Limiting (1 req/min)

**Decision**: Extend the existing `RedisThrottlerStorage` infrastructure with a custom guard that overrides `generateKey()` to scope by email address instead of IP.

**Implementation approach**:
```
EmailRateLimitGuard extends ThrottlerGuard {
  generateKey(context, suffix, throttlerName): string {
    const email = context.switchToHttp().getRequest().body?.email ?? 'anonymous';
    return `throttle:email:${Buffer.from(email.toLowerCase()).toString('base64')}:${suffix}`;
  }
}
```

Apply with `@UseGuards(EmailRateLimitGuard)` + `@Throttle({ email: { limit: 1, ttl: 60000 } })` on `forgot-password` and `resend-verification` endpoints.

**The existing global `ThrottlerGuard` (IP-based) continues to apply** — the email guard stacks on top as an additional layer.

**Rationale**: The project already has `RedisThrottlerStorage` and `ThrottlerModule.forRootAsync`. Extending with a custom guard requires no new dependencies and uses the existing Redis infrastructure.

**Alternatives considered**:
- Separate rate-limit library (`rate-limiter-flexible`): Rejected — adds a dependency when the existing infrastructure is sufficient.
- Manual Redis counter in service layer: Rejected — bypasses the guard abstraction, spreads rate-limit logic into business logic.

---

## R5 — JWT Blacklisting for Forced Reset (No Request Context)

**Decision**: Implement a **per-user token version counter** stored in Redis.

**Mechanism**:
- Key: `tv:{userId}` → Integer, default 0 (set at first login).
- At **login**: read `tv:{userId}` (or default 0), embed as `tokenVersion` claim in both access and refresh JWT payloads.
- In **JWT strategy `validate()`**: after signature check, read `tv:{userId}` from Redis → if `payload.tokenVersion < currentVersion`, reject with `401 Unauthorized`.
- On **forced reset**: `INCR tv:{userId}` in Redis → all existing tokens immediately fail version check on next request.
- On **voluntary logout**: existing `bl_{accessToken}` blacklist mechanism remains unchanged.

**Why this works without the target's token**: The version counter is keyed by `userId`, not by token value. The forced-reset operation only needs the `userId` — it increments the counter and all issued tokens become invalid on their next use.

**Access token natural expiry note** (per Q5 clarification): The current access token remains cryptographically valid until its ~15-minute natural expiry. The version check in the JWT strategy ensures it is rejected at validation time. After expiry, the refresh token cannot issue a new access token (refresh tokens are also revoked via `revokeAllUserRefreshTokens`).

**Rationale**: O(1) storage and O(1) invalidation. No need to track individual token strings. Scales to any number of concurrent sessions.

**Alternatives considered**:
- Store active access token hash per user at login: Rejected — only one access token per user tracked; breaks multi-device sessions and is harder to clean up.
- Add access token to existing `bl_` blacklist during forced reset: Rejected — requires the forced-reset caller to have the target's current access token string, which a server-side action does not have.
- Per-user Redis set of blacklisted token IDs: Rejected — O(n) growth per user over time without TTL management.
