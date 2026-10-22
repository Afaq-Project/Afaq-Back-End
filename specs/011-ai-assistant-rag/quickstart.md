# Quickstart & Verification Guide: AI Assistant & Conversational Memory RAG

**Feature**: `011-ai-assistant-rag`  
**Date**: 2026-10-18  
**Status**: Ready for Implementation  

---

## Prerequisites

1. **Environment Variables**:
   In your [`.env`](file:///home/abood/Project/Afaq/Afaq-backend/.env) file:
   ```env
   GEMINI_API_KEY=your-google-gemini-api-key
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```
2. **Supabase Database with `pgvector`**:
   The `vector` extension is enabled in Supabase (`CREATE EXTENSION IF NOT EXISTS vector;`).
3. **Dependencies Installed**:
   ```bash
   pnpm install
   ```

---

## Verification Scenarios

### Scenario 1: Multi-Turn Memory & Semantic Retrieval (RAG)

**Goal**: Verify that facts mentioned in early conversation turns are remembered and synthesized in later turns without bloating prompt context.

1. **Turn 1 (Share fact)**:
   ```bash
   curl -X POST http://localhost:3000/api/editor/ai/chat \
     -H "Authorization: Bearer $USER_JWT" \
     -H "Content-Type: application/json" \
     -d '{
       "message": "My undergraduate degree was in Mechanical Engineering at Cairo University, and I received the Dean Excellence Award in 2023."
     }'
   ```
   *Expected Outcome*: HTTP 200 OK with `conversationId`. The message and response are saved, and 384-d vector embeddings are stored asynchronously in `ai_message_embeddings`.

2. **Turns 2–10 (Distractor / Unrelated dialogue)**:
   Send multiple unrelated inquiries (e.g. asking about general scholarship essay word counts, deadlines, formatting).

3. **Turn 11 (Recall inquiry)**:
   ```bash
   curl -X POST http://localhost:3000/api/editor/ai/chat \
     -H "Authorization: Bearer $USER_JWT" \
     -H "Content-Type: application/json" \
     -d '{
       "conversationId": "$CONVERSATION_ID",
       "message": "Help me draft a short personal statement intro focusing on my university academic recognition."
     }'
   ```
   *Expected Outcome*: The response specifically references Mechanical Engineering and the Dean's Excellence Award without asking the user to repeat their degree or awards.

---

### Scenario 2: Delegated File-Editing Sub-Agent & Staged Proposals

**Goal**: Verify that requesting an edit triggers tool calling, returns a staged proposal, and creates a rollback version snapshot upon acceptance.

1. **Request an Edit via Chat**:
   ```bash
   curl -X POST http://localhost:3000/api/editor/ai/chat \
     -H "Authorization: Bearer $USER_JWT" \
     -H "Content-Type: application/json" \
     -d '{
       "pageId": "$PAGE_ID",
       "message": "Rewrite the introduction paragraph of my draft to adopt a formal academic tone and highlight my leadership."
     }'
   ```
   *Expected Outcome*: HTTP 200 OK containing both conversational `reply` and an `AiEditProposalDto` with status `PENDING`:
   ```json
   {
     "statusCode": 200,
     "data": {
       "reply": "I've drafted a revised version of your introduction with elevated academic tone.",
       "proposal": {
         "id": "prop-uuid-...",
         "pageId": "$PAGE_ID",
         "originalText": "...",
         "suggestedText": "...",
         "mode": "academic_tone",
         "status": "PENDING"
       }
     }
   }
   ```

2. **Accept the Proposal**:
   ```bash
   curl -X POST http://localhost:3000/api/editor/ai/proposals/$PROPOSAL_ID/accept \
     -H "Authorization: Bearer $USER_JWT"
   ```
   *Expected Outcome*:
   - Proposal status updates to `ACCEPTED`.
   - `DraftVersionsService.createSnapshot()` executes before mutation.
   - Draft page content in `draft_pages` updates with the new text.
   - HTTP 200 OK returned with `snapshotId` for rollback.

---

### Scenario 3: Local In-Process Embedding Performance & Offline Fallback

**Goal**: Prove vector embeddings generate locally in `< 30ms` with zero external API calls, and verify fallback behavior when credentials are missing.

1. **Run Unit & Benchmark Tests**:
   ```bash
   pnpm test src/modules/ai-assistant/
   ```
   *Expected Outcome*: All test suites pass with 100% success.
2. **Offline Fallback Check**:
   Temporarily unset `GEMINI_API_KEY` and issue a chat request.
   *Expected Outcome*: Graceful mock response returned with HTTP 200 OK; zero server crashes or 500 exceptions.
