# Data Model: Conversation Management

**Feature**: Conversation Management (`012-conversation-management`)  
**Status**: Completed  
**Date**: 2026-10-21  

---

## 1. Entities & Schema

The feature leverages existing PostgreSQL models managed by Prisma in [`prisma/schema.prisma`](file:///home/abood/Project/Afaq/Afaq-backend/prisma/schema.prisma#L684-L715). No database migrations or schema alterations are required.

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│         ai_conversations        │           │           ai_messages           │
├─────────────────────────────────┤           ├─────────────────────────────────┤
│ id: UUID (PK)                   │ 1       N │ id: UUID (PK)                   │
│ user_id: UUID (FK -> users)     ├──────────<│ conversation_id: UUID (FK)      │
│ title: VarChar(255)             │           │ role: VarChar(50)               │
│ created_at: Timestamptz         │           │ content: Text                   │
│ updated_at: Timestamptz         │           │ sources: JSONB (nullable)       │
└─────────────────────────────────┘           │ created_at: Timestamptz         │
                                              └─────────────────────────────────┘
```

### 1.1 `AiConversations` (`ai_conversations`)

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `@id`, `gen_random_uuid()` | Unique primary key for the conversation session. |
| `userId` | `UUID` | `@map("user_id")` | Foreign key referencing `users.id` with `onDelete: Cascade`. |
| `title` | `String` | `@db.VarChar(255)`, default `"New conversation"` | Display title of the conversation. |
| `createdAt` | `DateTime` | `@default(now())`, `@map("created_at")` | Timestamp when the conversation was initiated. |
| `updatedAt` | `DateTime?` | `@updatedAt`, `@map("updated_at")` | Timestamp when the most recent turn or update occurred. |

**Indexes**:
* `@@index([userId, updatedAt(sort: Desc)])`: Optimized for listing a user's conversations by recency.

---

### 1.2 `AiMessages` (`ai_messages`)

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `@id`, `gen_random_uuid()` | Unique primary key for the message turn. |
| `conversationId` | `UUID` | `@map("conversation_id")` | Foreign key referencing `ai_conversations.id` with `onDelete: Cascade`. |
| `role` | `String` | `@db.VarChar(50)` | Sender identity: `'user'` or `'assistant'`. |
| `content` | `String` | `@db.Text` | Complete textual message content. |
| `sources` | `Json?` | Optional JSONB | Optional tool-call metadata (e.g. edit proposals). Omitted from public history DTO. |
| `createdAt` | `DateTime` | `@default(now())`, `@map("created_at")` | Creation timestamp of the message. |

**Indexes**:
* `@@index([conversationId, createdAt])`: Optimized for chronological order queries (`ORDER BY created_at ASC`).

---

## 2. DTO Specifications & Validation Rules

### 2.1 Unified Query DTO: `ConversationPaginationQueryDto` (in `conversation-pagination-query.dto.ts`)

A shared query DTO utilized by both `GET /editor/ai/conversations` and `GET /editor/ai/conversations/:conversationId/messages`:
* `page`: Integer, optional, default `1`, minimum `1`.
* `limit`: Integer, optional, default `20`, minimum `1`, maximum `50`.

```typescript
export class ConversationPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

// Export alias for semantic clarity across consumers
export { ConversationPaginationQueryDto as ListConversationsQueryDto };
```
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
```

---

### 2.2 Response DTOs

#### `ConversationSummaryDto`
* `id` (`string`, UUID)
* `title` (`string`)
* `createdAt` (`string`, ISO 8601)
* `updatedAt` (`string`, ISO 8601)
* `messageCount` (`number`)
* `lastMessagePreview` (`string | null`, at most 100 characters)

#### `ConversationMessageItemDto`
* `id` (`string`, UUID)
* `role` (`'user' | 'assistant'`)
* `content` (`string`)
* `createdAt` (`string`, ISO 8601)

---

## 3. Business & Security Validation Rules

1. **Ownership Enforcement**: Every query must join or filter on `userId: current_user.id`.
2. **404 Behavior**: If `conversationId` is requested and either does not exist or belongs to another user, return `404 Not Found`.
3. **Data Sanitization**: Internal vector embeddings (`ai_message_embeddings`) and internal system prompt injections are completely omitted from response DTOs.
