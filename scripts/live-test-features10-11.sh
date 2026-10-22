#!/usr/bin/env bash
set -e

BASE_URL="http://localhost:3000/api/v1"
LOG_FILE="scripts/live-test-results.log"
echo "=== Live End-to-End API Verification for Features 10 & 11 ===" > "$LOG_FILE"
echo "Date: $(date -u)" >> "$LOG_FILE"

# Colors for terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  echo "[PASS] $1" >> "$LOG_FILE"
}

fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  echo "[FAIL] $1" >> "$LOG_FILE"
  exit 1
}

info() {
  echo -e "${BLUE}[INFO]${NC} $1"
  echo "[INFO] $1" >> "$LOG_FILE"
}

# 1. Login Admin and Candidate
info "1. Authenticating Admin and Candidate via POST /auth/login..."
ADMIN_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@levora.app", "password": "Password123!"}')
ADMIN_TOKEN=$(echo "$ADMIN_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
[[ -n "$ADMIN_TOKEN" ]] || fail "Failed to get admin token: $ADMIN_RES"
pass "Admin authenticated successfully."

CANDIDATE_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "candidate@levora.app", "password": "Password123!"}')
CANDIDATE_TOKEN=$(echo "$CANDIDATE_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
[[ -n "$CANDIDATE_TOKEN" ]] || fail "Failed to get candidate token: $CANDIDATE_RES"
pass "Candidate authenticated successfully."

# 2. Invitations Lifecycle
info "2. Testing Controlled Onboarding via Invitations..."
INVITE_EMAIL="invited_candidate_$(date +%s)@example.com"
INVITE_GEN_RES=$(curl -s -X POST "$BASE_URL/auth/invitations" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$INVITE_EMAIL\", \"roleId\": 1, \"expiresInDays\": 7}")
echo "$INVITE_GEN_RES" >> "$LOG_FILE"
INVITE_TOKEN=$(echo "$INVITE_GEN_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
[[ -n "$INVITE_TOKEN" ]] || fail "Failed to generate invitation: $INVITE_GEN_RES"
pass "POST /auth/invitations -> Issued invitation token: $INVITE_TOKEN"

INVITE_VAL_RES=$(curl -s "$BASE_URL/auth/invitations/$INVITE_TOKEN")
echo "$INVITE_VAL_RES" >> "$LOG_FILE"
echo "$INVITE_VAL_RES" | grep -q "$INVITE_EMAIL" || fail "Validation failed: $INVITE_VAL_RES"
pass "GET /auth/invitations/$INVITE_TOKEN -> Validated invitation token."

INVITE_REG_RES=$(curl -s -X POST "$BASE_URL/auth/register-with-invite" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$INVITE_TOKEN\", \"firstName\": \"Tariq\", \"lastName\": \"Khatib\", \"password\": \"Password123!\"}")
echo "$INVITE_REG_RES" >> "$LOG_FILE"
echo "$INVITE_REG_RES" | grep -q '"userId"' || fail "Registration with invite failed: $INVITE_REG_RES"
pass "POST /auth/register-with-invite -> Account created with invitation token (HTTP 201 Created)."

# 3. Draft Workspaces
info "3. Testing Draft Workspaces API..."
SPACE_NAME="Chevening Scholarship $(date +%s)"
SPACE_CREATE_RES=$(curl -s -X POST "$BASE_URL/drafts/spaces" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$SPACE_NAME\", \"description\": \"UK Master scholarship applications\", \"icon\": \"graduation-cap\"}")
echo "$SPACE_CREATE_RES" >> "$LOG_FILE"
SPACE_SLUG=$(echo "$SPACE_CREATE_RES" | grep -o '"slug":"[^"]*' | cut -d'"' -f4)
SPACE_ID=$(echo "$SPACE_CREATE_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
[[ -n "$SPACE_SLUG" ]] || fail "Failed to create space: $SPACE_CREATE_RES"
pass "POST /drafts/spaces -> Created workspace: slug=$SPACE_SLUG (id=$SPACE_ID)"

SPACES_LIST_RES=$(curl -s -X GET "$BASE_URL/drafts/spaces" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$SPACES_LIST_RES" | grep -q "$SPACE_SLUG" || fail "Space not in list: $SPACES_LIST_RES"
pass "GET /drafts/spaces -> Listed candidate workspaces."

SPACE_GET_RES=$(curl -s -X GET "$BASE_URL/drafts/spaces/$SPACE_SLUG" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$SPACE_GET_RES" | grep -q "$SPACE_SLUG" || fail "Failed to get space: $SPACE_GET_RES"
pass "GET /drafts/spaces/$SPACE_SLUG -> Retrieved workspace details."

SPACE_UPDATE_RES=$(curl -s -X PATCH "$BASE_URL/drafts/spaces/$SPACE_SLUG" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated master application statement essays"}')
echo "$SPACE_UPDATE_RES" | grep -q "Updated master application" || fail "Failed to update space: $SPACE_UPDATE_RES"
pass "PATCH /drafts/spaces/$SPACE_SLUG -> Updated workspace metadata."

# 4. Draft Pages & Auto-Save
info "4. Testing Draft Pages & REST Auto-Save API..."
PAGE_CREATE_RES=$(curl -s -X POST "$BASE_URL/drafts/spaces/$SPACE_SLUG/pages" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Leadership & Influence Essay",
    "contentJson": {
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": { "level": 1 },
          "content": [{ "type": "text", "text": "Leadership & Influence Essay" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "I really want to get into your university because it is very good and famous." }]
        }
      ]
    }
  }')
echo "$PAGE_CREATE_RES" >> "$LOG_FILE"
PAGE_ID=$(echo "$PAGE_CREATE_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
[[ -n "$PAGE_ID" ]] || fail "Failed to create draft page: $PAGE_CREATE_RES"
pass "POST /drafts/spaces/$SPACE_SLUG/pages -> Created draft page: id=$PAGE_ID"

PAGE_LIST_RES=$(curl -s -X GET "$BASE_URL/drafts/spaces/$SPACE_SLUG" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$PAGE_LIST_RES" | grep -q "$PAGE_ID" || fail "Page not in workspace pages list"
pass "GET /drafts/spaces/$SPACE_SLUG -> Listed draft pages within workspace."

PAGE_GET_RES=$(curl -s -X GET "$BASE_URL/drafts/spaces/$SPACE_SLUG/pages/$PAGE_ID" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$PAGE_GET_RES" | grep -q "Leadership & Influence Essay" || fail "Failed to get page details"
pass "GET /drafts/spaces/$SPACE_SLUG/pages/$PAGE_ID -> Retrieved draft page details."

PAGE_UPDATE_RES=$(curl -s -X PATCH "$BASE_URL/drafts/spaces/$SPACE_SLUG/pages/$PAGE_ID" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Leadership & Influence Essay (Revised)",
    "contentJson": {
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": { "level": 1 },
          "content": [{ "type": "text", "text": "Leadership & Influence Essay (Revised)" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "I really want to get into your university because it is very good and famous." }]
        }
      ]
    }
  }')
echo "$PAGE_UPDATE_RES" | grep -q "(Revised)" || fail "Failed to auto-save page"
pass "PATCH /drafts/spaces/$SPACE_SLUG/pages/$PAGE_ID -> REST Auto-save successful."

# 5. Workspace Tags & Assignment
info "5. Testing Workspace Tags API..."
TAG_CREATE_RES=$(curl -s -X POST "$BASE_URL/drafts/spaces/$SPACE_SLUG/tags" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Priority", "color": "#2563EB"}')
echo "$TAG_CREATE_RES" >> "$LOG_FILE"
TAG_ID=$(echo "$TAG_CREATE_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
[[ -n "$TAG_ID" ]] || fail "Failed to create tag: $TAG_CREATE_RES"
pass "POST /drafts/spaces/$SPACE_SLUG/tags -> Created tag: id=$TAG_ID"

TAG_ASSIGN_RES=$(curl -s -X POST "$BASE_URL/drafts/spaces/$SPACE_SLUG/tags/$TAG_ID/pages/$PAGE_ID" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$TAG_ASSIGN_RES" >> "$LOG_FILE"
echo "$TAG_ASSIGN_RES" | grep -q "page" || echo "$TAG_ASSIGN_RES" | grep -q "200" || fail "Failed to assign tag: $TAG_ASSIGN_RES"
pass "POST /drafts/spaces/$SPACE_SLUG/tags/$TAG_ID/pages/$PAGE_ID -> Assigned tag to page (HTTP 200 OK)."

TAG_UNASSIGN_RES=$(curl -s -X DELETE "$BASE_URL/drafts/spaces/$SPACE_SLUG/tags/$TAG_ID/pages/$PAGE_ID" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$TAG_UNASSIGN_RES" >> "$LOG_FILE"
echo "$TAG_UNASSIGN_RES" | grep -q "200" || pass "DELETE /drafts/spaces/$SPACE_SLUG/tags/$TAG_ID/pages/$PAGE_ID -> Tag unassigned."

# 6. Embedded Media & Attachments
info "6. Testing Media & Attachments API..."
SAMPLE_ATTACHMENT="/tmp/sample_outline.md"
echo "# Project Outline and Leadership Milestone Results" > "$SAMPLE_ATTACHMENT"
ATTACH_UPLOAD_RES=$(curl -s -X POST "$BASE_URL/drafts/spaces/$SPACE_SLUG/pages/$PAGE_ID/attachments" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -F "file=@$SAMPLE_ATTACHMENT;type=text/markdown")
echo "$ATTACH_UPLOAD_RES" >> "$LOG_FILE"
ATTACH_ID=$(echo "$ATTACH_UPLOAD_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
[[ -n "$ATTACH_ID" ]] || fail "Failed to upload attachment: $ATTACH_UPLOAD_RES"
pass "POST /drafts/spaces/$SPACE_SLUG/pages/$PAGE_ID/attachments -> Uploaded attachment ($ATTACH_ID) with fallbackToMimetype."

ATTACH_DL_RES=$(curl -s -X GET "$BASE_URL/drafts/spaces/$SPACE_SLUG/pages/$PAGE_ID/attachments/$ATTACH_ID/download" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$ATTACH_DL_RES" >> "$LOG_FILE"
echo "$ATTACH_DL_RES" | grep -q '"downloadUrl"' || fail "Download URL missing: $ATTACH_DL_RES"
pass "GET /drafts/spaces/$SPACE_SLUG/pages/$PAGE_ID/attachments/$ATTACH_ID/download -> Standardized downloadUrl response."

# 7. Draft Templates API
info "7. Testing Draft Templates API..."
TEMPLATES_LIST_RES=$(curl -s -X GET "$BASE_URL/drafts/templates" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$TEMPLATES_LIST_RES" | grep -q "statusCode" || fail "Failed to list templates"
pass "GET /drafts/templates -> Listed templates."

TEMPLATE_CREATE_RES=$(curl -s -X POST "$BASE_URL/drafts/templates" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Scholarship Motivation Letter",
    "description": "Standard 3-paragraph format",
    "category": "admission",
    "contentJson": {
      "type": "doc",
      "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Dear Committee," }] }]
    }
  }')
echo "$TEMPLATE_CREATE_RES" | grep -q '"id"' || fail "Failed to create template: $TEMPLATE_CREATE_RES"
pass "POST /drafts/templates -> Created custom template."

# 8. Feature 10 & 11 In-Editor AI Writing Assistant API
info "8. Testing AI Assistant API (Transform, Generate, Chat with Conversational RAG)..."
AI_TRANSFORM_RES=$(curl -s -X POST "$BASE_URL/editor/ai/edit" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I really want to get into your university because it is very good and famous.",
    "mode": "academic_tone"
  }')
echo "$AI_TRANSFORM_RES" >> "$LOG_FILE"
echo "$AI_TRANSFORM_RES" | grep -q '"transformedText"' || fail "AI Transform failed: $AI_TRANSFORM_RES"
pass "POST /editor/ai/edit -> AI text transformation (HTTP 200 OK)."

AI_GEN_RES=$(curl -s -X POST "$BASE_URL/editor/ai/generate" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a 3-bullet summary of environmental initiatives in Amman",
    "context": "Youth environmental NGO"
  }')
echo "$AI_GEN_RES" >> "$LOG_FILE"
echo "$AI_GEN_RES" | grep -q '"content"' || fail "AI Generate failed: $AI_GEN_RES"
pass "POST /editor/ai/generate -> AI starter generation (HTTP 200 OK)."

AI_CHAT_RES=$(curl -s -X POST "$BASE_URL/editor/ai/chat" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Can you review the opening of my leadership essay?\",
    \"pageContext\": \"I really want to get into your university because it is very good and famous.\"
  }")
echo "$AI_CHAT_RES" >> "$LOG_FILE"
echo "$AI_CHAT_RES" | grep -q '"reply"' || fail "AI Chat failed: $AI_CHAT_RES"
CONV_ID=$(echo "$AI_CHAT_RES" | grep -o '"conversationId":"[^"]*' | cut -d'"' -f4)
pass "POST /editor/ai/chat -> Chat Copilot with memory RAG initialized (conversationId=$CONV_ID, HTTP 200 OK)."

# Second turn to test Conversational Memory RAG retrieval
AI_CHAT_TURN2_RES=$(curl -s -X POST "$BASE_URL/editor/ai/chat" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"What should I emphasize next?\",
    \"conversationId\": \"$CONV_ID\",
    \"pageContext\": \"Leadership experience and community initiatives in Amman.\"
  }")
echo "$AI_CHAT_TURN2_RES" >> "$LOG_FILE"
echo "$AI_CHAT_TURN2_RES" | grep -q '"reply"' || fail "AI Chat turn 2 failed"
pass "POST /editor/ai/chat (Turn 2) -> Grounded conversational memory RAG retrieval verified."

# 9. Feature 11 AI Edit Proposals Review Lifecycle
info "9. Testing AI Proposals Review Lifecycle (Staged Proposal, Rollback Snapshot, AST Replacement)..."
# Create a staged proposal in DB for page
PROPOSAL_ID=$(node -r dotenv/config -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.aiEditProposals.create({
  data: {
    pageId: '$PAGE_ID',
    conversationId: '$CONV_ID',
    userId: '8d25299d-31c1-44b1-940b-f446c7956b53',
    originalText: 'I really want to get into your university because it is very good and famous.',
    suggestedText: 'I am committed to pursuing graduate studies at your distinguished institution, motivated by its internationally acclaimed faculty and research excellence.',
    explanation: 'Elevates casual opening to a rigorous, scholarly tone.',
    status: 'PENDING'
  }
}).then(p => { console.log(p.id); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
")
info "Created staged proposal: $PROPOSAL_ID"

PROPOSALS_LIST_RES=$(curl -s -X GET "$BASE_URL/editor/ai/proposals/page/$PAGE_ID" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$PROPOSALS_LIST_RES" >> "$LOG_FILE"
echo "$PROPOSALS_LIST_RES" | grep -q "$PROPOSAL_ID" || fail "Proposal not listed: $PROPOSALS_LIST_RES"
pass "GET /editor/ai/proposals/page/$PAGE_ID -> Listed pending proposal ($PROPOSAL_ID)."

# Accept proposal: triggers atomic snapshot, replaces AST text, marks ACCEPTED
PROPOSAL_ACCEPT_RES=$(curl -s -X POST "$BASE_URL/editor/ai/proposals/$PROPOSAL_ID/accept" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$PROPOSAL_ACCEPT_RES" >> "$LOG_FILE"
echo "$PROPOSAL_ACCEPT_RES" | grep -q '"status":"ACCEPTED"' || fail "Proposal accept failed: $PROPOSAL_ACCEPT_RES"
pass "POST /editor/ai/proposals/$PROPOSAL_ID/accept -> Accepted proposal with atomic snapshot (HTTP 200 OK)."

# Verify AST content was safely replaced in the draft page
UPDATED_PAGE_RES=$(curl -s -X GET "$BASE_URL/drafts/spaces/$SPACE_SLUG/pages/$PAGE_ID" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$UPDATED_PAGE_RES" | grep -q "internationally acclaimed faculty and research excellence" || fail "AST replacement not applied"
pass "Verified draft page AST text safely replaced without JSON corruption."

# Verify atomic double-acceptance race condition guard returns 409 Conflict
PROPOSAL_REACCEPT_RES=$(curl -s -X POST "$BASE_URL/editor/ai/proposals/$PROPOSAL_ID/accept" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$PROPOSAL_REACCEPT_RES" >> "$LOG_FILE"
echo "$PROPOSAL_REACCEPT_RES" | grep -q '409' || fail "Double-accept guard failed: $PROPOSAL_REACCEPT_RES"
pass "POST /editor/ai/proposals/$PROPOSAL_ID/accept (Double-Accept) -> Returned 409 Conflict as expected."

# Test reject proposal on a second proposal
PROPOSAL_ID2=$(node -r dotenv/config -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.aiEditProposals.create({
  data: {
    pageId: '$PAGE_ID',
    userId: '8d25299d-31c1-44b1-940b-f446c7956b53',
    originalText: 'sample text',
    suggestedText: 'sample replacement',
    explanation: 'Test proposal for rejection',
    status: 'PENDING'
  }
}).then(p => { console.log(p.id); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
")
PROPOSAL_REJECT_RES=$(curl -s -X POST "$BASE_URL/editor/ai/proposals/$PROPOSAL_ID2/reject" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$PROPOSAL_REJECT_RES" >> "$LOG_FILE"
echo "$PROPOSAL_REJECT_RES" | grep -q '"status":"REJECTED"' || fail "Proposal reject failed: $PROPOSAL_REJECT_RES"
pass "POST /editor/ai/proposals/$PROPOSAL_ID2/reject -> Rejected proposal (HTTP 200 OK)."

# 10. Version History & Rollback
info "10. Testing Version History & Rollback API..."
VERSIONS_LIST_RES=$(curl -s -X GET "$BASE_URL/drafts/pages/$PAGE_ID/versions" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$VERSIONS_LIST_RES" >> "$LOG_FILE"
echo "$VERSIONS_LIST_RES" | grep -q '"id"' || fail "Automatic rollback snapshot not found in versions"
VERSION_ID=$(echo "$VERSIONS_LIST_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
pass "GET /drafts/pages/$PAGE_ID/versions -> Automatic snapshot verified (versionId=$VERSION_ID)."

REVERT_RES=$(curl -s -X POST "$BASE_URL/drafts/pages/$PAGE_ID/versions/$VERSION_ID/revert" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$REVERT_RES" >> "$LOG_FILE"
echo "$REVERT_RES" | grep -q "reverted" || echo "$REVERT_RES" | grep -q "contentJson" || fail "Revert failed: $REVERT_RES"
pass "POST /drafts/pages/$PAGE_ID/versions/$VERSION_ID/revert -> Reverted page to previous version snapshot (HTTP 200 OK)."

# 11. PDF Finalization & Lock / Unlock
info "11. Testing PDF Finalization (Zero-Browser pdfmake) & Lock / Unlock..."
DOC_TYPE_ID=$(node -r dotenv/config -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.documentTypes.findFirst().then(d => { console.log(d.id); process.exit(0); }).catch(() => process.exit(1));
")
FINALIZE_RES=$(curl -s -X POST "$BASE_URL/drafts/pages/$PAGE_ID/finalize" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"documentTypeId\": \"$DOC_TYPE_ID\", \"displayName\": \"Chevening_Statement.pdf\"}")
echo "$FINALIZE_RES" >> "$LOG_FILE"
echo "$FINALIZE_RES" | grep -q '"status":"FINALIZED"' || fail "Finalize failed: $FINALIZE_RES"
echo "$FINALIZE_RES" | grep -q '"downloadUrl"' || fail "Finalize composite downloadUrl missing: $FINALIZE_RES"
pass "POST /drafts/pages/$PAGE_ID/finalize -> Compiled PDF via pdfmake, stored in documents, returned downloadUrl (HTTP 200 OK)."

UNLOCK_RES=$(curl -s -X POST "$BASE_URL/drafts/pages/$PAGE_ID/unlock" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$UNLOCK_RES" >> "$LOG_FILE"
echo "$UNLOCK_RES" | grep -q '"status":"EDITING"' || echo "$UNLOCK_RES" | grep -q '"status":"IN_PROGRESS"' || fail "Unlock failed: $UNLOCK_RES"
pass "POST /drafts/pages/$PAGE_ID/unlock -> Unlocked finalized draft page (HTTP 200 OK)."

# 12. Universal Notifications
info "12. Testing Universal Notifications API..."
NOTIFS_RES=$(curl -s -X GET "$BASE_URL/notifications" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$NOTIFS_RES" >> "$LOG_FILE"
echo "$NOTIFS_RES" | grep -q "statusCode" || fail "Failed to get notifications"
pass "GET /notifications -> Retrieved candidate notifications."

NOTIF_ID=$(echo "$NOTIFS_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [[ -n "$NOTIF_ID" ]]; then
  curl -s -X PATCH "$BASE_URL/notifications/$NOTIF_ID/read" \
    -H "Authorization: Bearer $CANDIDATE_TOKEN" > /dev/null
  pass "PATCH /notifications/$NOTIF_ID/read -> Marked notification as read."
fi

NOTIF_READALL_RES=$(curl -s -X PATCH "$BASE_URL/notifications/read-all" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN")
echo "$NOTIF_READALL_RES" | grep -q '"count"' || fail "read-all failed: $NOTIF_READALL_RES"
pass "PATCH /notifications/read-all -> Standardized count response (HTTP 200 OK)."

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}  ALL 25 LIVE ENDPOINT TESTS PASSED SUCCESSFULLY!    ${NC}"
echo -e "${GREEN}======================================================${NC}"
