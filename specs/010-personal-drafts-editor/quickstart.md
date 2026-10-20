# Quickstart Validation Guide: Personal Drafts & Document Editor

**Feature Branch**: `010-personal-drafts-editor`  
**Date**: 2026-10-17  
**Status**: Ready for Validation  

This guide provides runnable scenarios to validate the Personal Drafts, AI Assistant, and Document Finalization subsystems end-to-end.

---

## 1. Prerequisites & Environment Setup

1. **Verify Environment Variables** in `.env`:
   ```bash
   DATABASE_URL="postgresql://user:pass@localhost:5432/afaq_dev"
   AWS_REGION="eu-central-1"
   AWS_S3_BUCKET_NAME="afaq-documents"
   OPENAI_API_KEY="sk-..."
   ```

2. **Execute Database Migration**:
   ```bash
   pnpm prisma migrate dev --name add_drafts_ai_and_invitation_modules
   pnpm prisma:generate
   ```

3. **Start Development Server**:
   ```bash
   pnpm start:dev
   ```

---

## 2. End-to-End Validation Scenarios

### Scenario 1: Private Workspace & Draft Creation
**Goal**: Verify that a user can create a private workspace with custom slugs and an initial document.

```bash
# 1. Create a user-scoped draft workspace
curl -X POST http://localhost:3000/api/v1/drafts/spaces \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fulbright 2026",
    "description": "Application essays and CV drafts"
  }'
# Expected: 201 Created with slug "fulbright-2026"

# 2. Create a draft document inside the workspace
curl -X POST http://localhost:3000/api/v1/drafts/spaces/fulbright-2026/pages \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Study Objective Essay"
  }'
# Expected: 201 Created with page ID and status "DRAFT"
```

---

### Scenario 2: REST Auto-Save & Version Snapshot
**Goal**: Verify background debounced auto-saving of TipTap JSON and automatic version snapshot creation.

```bash
curl -X PATCH http://localhost:3000/api/v1/drafts/spaces/fulbright-2026/pages/$PAGE_ID \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Study Objective Essay",
    "contentJson": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "I am applying to pursue advanced research in renewable energy systems..." }
          ]
        }
      ]
    },
    "status": "IN_PROGRESS"
  }'
# Expected: 200 OK. Version snapshot recorded in draft_page_versions.
```

---

### Scenario 3: In-Editor AI Writing Enhancement
**Goal**: Verify contextual inline text transformation.

```bash
curl -X POST http://localhost:3000/api/v1/editor/ai/edit \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I really want to study this because it is very good and helps my career a lot.",
    "mode": "academic_tone"
  }'
# Expected: 200 OK with sophisticated academic phrasing suggestion.
```

---

### Scenario 4: Document Finalization & Profile Activation
**Goal**: Verify HTML-to-PDF rendering, official S3 upload, base `documents` insertion, profile activation, and draft read-only locking.

```bash
# 1. Finalize draft
curl -X POST http://localhost:3000/api/v1/drafts/pages/$PAGE_ID/finalize \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Fulbright_Study_Objective.pdf"
  }'
# Expected: 201 Created. Returns document record from native `documents` table.

# 2. Verify draft is locked in read-only FINALIZED state
curl -X PATCH http://localhost:3000/api/v1/drafts/spaces/fulbright-2026/pages/$PAGE_ID \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Attempted Edit While Locked" }'
# Expected: 403 Forbidden ("Draft is locked in FINALIZED state. Please unlock to create a new revision.")
```

---

### Scenario 5: Unlock & Revision Cycle
**Goal**: Verify that unlocking a finalized draft allows edits and subsequent re-finalization produces a new version without destroying past documents.

```bash
# 1. Unlock draft
curl -X POST http://localhost:3000/api/v1/drafts/pages/$PAGE_ID/unlock \
  -H "Authorization: Bearer $USER_TOKEN"
# Expected: 200 OK. Status transitions to IN_PROGRESS.

# 2. Make revision and re-finalize
curl -X POST http://localhost:3000/api/v1/drafts/pages/$PAGE_ID/finalize \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "displayName": "Fulbright_Study_Objective_v2.pdf" }'
# Expected: 201 Created. New document created in `documents`; previous document remains intact in repository.
```

---

## 3. Automated Test Execution

Run the complete test suite:
```bash
# Unit and service tests (Ensure >=80% coverage)
pnpm test src/modules/drafts src/modules/ai-assistant src/modules/notifications

# Integration / E2E tests
pnpm test:e2e
```
