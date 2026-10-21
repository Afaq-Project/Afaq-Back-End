# Quickstart Validation Guide: Conversation Management

**Feature**: Conversation Management (`012-conversation-management`)  
**Status**: Ready for Validation  
**Date**: 2026-10-21  

---

## 1. Prerequisites

1. PostgreSQL and Redis running locally.
2. Backend application compiled and running:
   ```bash
   pnpm start:dev
   ```
3. An active user access token:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"P@ssw0rd123!"}' \
     | jq -r '.data.accessToken')
   ```

---

## 2. Validation Scenarios

### Scenario 1: List Conversations
Retrieve the user's active conversation list ordered by recent activity.

**Command**:
```bash
curl -s -X GET "http://localhost:3000/api/v1/editor/ai/conversations?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected Outcome**:
* HTTP Status `200 OK`.
* `data` is an array of objects containing `id`, `title`, `createdAt`, `updatedAt`, `messageCount`, and `lastMessagePreview` (truncated to <=100 chars).
* `meta` contains `{ "page": 1, "limit": 20, "total": ..., "totalPages": ... }`.

---

### Scenario 2: Load Selected Conversation Messages
Retrieve the chronological message turns for a specific conversation.

**Command**:
```bash
CONV_ID="<conversation-id-from-scenario-1>"

curl -s -X GET "http://localhost:3000/api/v1/editor/ai/conversations/$CONV_ID/messages?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected Outcome**:
* HTTP Status `200 OK`.
* `data` is a chronological array of turns with `id`, `role` (`user` or `assistant`), `content`, and `createdAt`.
* Vector embeddings and internal prompt directives are excluded.

---

### Scenario 3: Verify Cross-Tenant Isolation (IDOR Defense)
Attempt to access a conversation using a different candidate's credentials.

**Command**:
```bash
OTHER_USER_TOKEN="<token-for-another-user>"

curl -s -w "\nHTTP Status: %{http_code}\n" -X GET "http://localhost:3000/api/v1/editor/ai/conversations/$CONV_ID/messages" \
  -H "Authorization: Bearer $OTHER_USER_TOKEN" | jq .
```

**Expected Outcome**:
* HTTP Status `404 Not Found`.
* Error response: `SYSTEM_RESOURCE_NOT_FOUND` ("Conversation not found").
* Zero metadata or message content is leaked.

---

### Scenario 4: Automated Test Execution

Run targeted unit and e2e test suites:

```bash
# Run unit tests for AI conversations
pnpm test -- --grep "AiConversations"

# Run e2e tests
pnpm test:e2e
```
