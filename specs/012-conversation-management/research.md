# Research & Architecture Decisions: Conversation Management

**Feature**: Conversation Management (`012-conversation-management`)  
**Status**: Completed  
**Date**: 2026-10-21  

---

## 1. Controller Architecture & Routing

### Decision
Create a dedicated `AiConversationsController` registered in `AiAssistantModule` under route prefix `editor/ai/conversations`:
* `GET /editor/ai/conversations` (List conversation sessions)
* `GET /editor/ai/conversations/:conversationId/messages` (Get message history)

### Rationale
* **Single Responsibility Principle (SRP)**: Keeps real-time inference (`AiChatController` at `editor/ai/chat`) separated from conversation resource browsing (`AiConversationsController`).
* **REST Resource Alignment**: `/editor/ai/conversations` represents the conversation collection; `/editor/ai/conversations/:id/messages` represents the sub-resource of messages.
* **Consistency**: Follows established patterns in the repository (e.g. `AiProposalsController` under `editor/ai/proposals`).

### Alternatives Considered
* **Adding routes to `AiChatController`**: Rejected because `AiChatController` focuses on prompt orchestration and streaming/tool-calling; adding collection browsing violates SRP and increases controller test surface.

---

## 2. Message History Query & Pagination Strategy

### Decision
* Support standard pagination query parameters: `page` (default 1, minimum 1) and `limit` (default 20, minimum 1, maximum 50).
* Sort message history in **ascending chronological order** (`createdAt: 'asc'`) to facilitate natural top-to-bottom chat UI rendering.
* Return standardized metadata: `{ page, limit, total, totalPages }`.

### Rationale
* **Payload Control**: Long conversation sessions may contain lengthy essay drafts, feedback, and AST tool calls. Enforcing a default of 20 and cap of 50 guarantees predictable response times and avoids heap memory exhaustion.
* **Index Utilization**: Leverages the existing compound index `@@index([conversationId, createdAt])` on `ai_messages` for fast, zero-scan retrieval.

### Alternatives Considered
* **Cursor-based pagination**: Evaluated, but standard page/limit pagination aligns with the project's global `PaginationDto` pattern and meets all UI needs for paginating through turn batches.
* **Unpaginated full load**: Explicitly rejected during clarification (Option B selected) to prevent unbounded memory usage.

---

## 3. Last Message Preview & Count Aggregation

### Decision
Use Prisma's native relational inclusion and aggregation in a single query:
```typescript
prisma.aiConversations.findMany({
  where: { userId },
  orderBy: { updatedAt: 'desc' },
  skip: (page - 1) * limit,
  take: limit,
  include: {
    _count: { select: { messages: true } },
    messages: {
      take: 1,
      orderBy: { createdAt: 'desc' },
      select: { content: true, role: true, createdAt: true },
    },
  },
});
```
Truncate `content` to at most 100 characters in the application layer.

### Rationale
* **Zero N+1 Queries**: Executes in a single database round-trip without nested queries in application loops.
* **No Schema Migrations**: Avoids adding denormalized columns (`last_message_preview`, `message_count`) to `ai_conversations`, keeping data normalization clean and preventing data sync anomalies.

### Alternatives Considered
* **Denormalizing columns on `ai_conversations`**: Rejected because it requires database migrations and extra transaction overhead on every new message insertion.

---

## 4. Multi-Tenant Authorization & Security Isolation

### Decision
* Enforce tenant scoping directly in the Prisma `where` clause: `where: { id: conversationId, userId }`.
* If a conversation ID is not found for the authenticated user, throw a `NotFoundException('Conversation not found')` with error code `SYSTEM_RESOURCE_NOT_FOUND`.

### Rationale
* **Defense in Depth**: Prevents Insecure Direct Object References (IDOR).
* **Information Leak Prevention**: Returning `404 Not Found` rather than `403 Forbidden` ensures an attacker cannot enumerate valid conversation IDs belonging to other candidates.
* **Token Authenticity**: Enforced via global `JwtAuthGuard` and extraction of `req.user.id`.

### Alternatives Considered
* **Fetching by ID then checking user ownership**: Rejected because it risks leaking existence and requires two separate checks.
