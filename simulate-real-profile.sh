#!/bin/bash
# simulate-real-profile.sh
# Simulates a full profile creation flow via Levora API

BASE_URL="http://localhost:3000/api/v1"
EMAIL="smoke-test@levora.com"
PASSWORD="TestPass123!"

echo "═══════════════════════════════════════════════════"
echo "  Levora Profile Simulation Flow"
echo "═══════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────
# STEP 1: Login & extract token
# ─────────────────────────────────────────────────────
echo ""
echo "▶ [1/8] Logging in as $EMAIL..."
LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken')
USER_ID=$(echo "$LOGIN" | jq -r '.data.user.id')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed:"
  echo "$LOGIN" | jq .
  exit 1
fi
echo "✅ Token acquired (user: $USER_ID)"

AUTH="Authorization: Bearer $TOKEN"
JSON="Content-Type: application/json"

# ─────────────────────────────────────────────────────
# STEP 2: Fetch reference data (needed for IDs)
# ─────────────────────────────────────────────────────
echo ""
echo "▶ [2/8] Fetching reference data..."

FIELDS=$(curl -s "$BASE_URL/reference/fields-of-study")
FIELD_ID=$(echo "$FIELDS" | jq -r '.data[0].id')
echo "  → Field of study: $(echo "$FIELDS" | jq -r '.data[0].name') ($FIELD_ID)"

SKILLS=$(curl -s "$BASE_URL/reference/skills-taxonomy")
SKILL_ID=$(echo "$SKILLS" | jq -r '.data[0].skills[0].id')
SKILL_NAME=$(echo "$SKILLS" | jq -r '.data[0].skills[0].name')
echo "  → Skill: $SKILL_NAME ($SKILL_ID)"

LANGS=$(curl -s "$BASE_URL/reference/languages")
LANG_ID=$(echo "$LANGS" | jq -r '.data[0].id')
LANG_NAME=$(echo "$LANGS" | jq -r '.data[0].name')
echo "  → Language: $LANG_NAME ($LANG_ID)"

# ─────────────────────────────────────────────────────
# STEP 3: Update basic profile info
# ─────────────────────────────────────────────────────
echo ""
echo "▶ [3/8] Updating profile basic info..."
curl -s -X PATCH "$BASE_URL/profile" \
  -H "$JSON" -H "$AUTH" \
  -d '{
    "fullName": "John Doe",
    "dateOfBirth": "1998-05-15",
    "nationality": "US",
    "educationLevel": "Bachelor",
    "currentCountry": "United States",
    "currentCity": "San Francisco",
    "phone": "+1-555-0199",
    "experienceLevel": "Mid-Level",
    "hasFinancialNeed": false,
    "careerGoals": "Aspiring AI Engineer looking for master scholarship and research opportunities.",
    "profilePhotoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
  }' | jq '{statusCode, message, completionPct: .data.completionPct, coreFieldsComplete: .data.coreFieldsComplete}'

# ─────────────────────────────────────────────────────
# STEP 4: Add field of study
# ─────────────────────────────────────────────────────
echo ""
echo "▶ [4/8] Adding field of study..."
curl -s -X POST "$BASE_URL/profile/fields-of-study" \
  -H "$JSON" -H "$AUTH" \
  -d "{\"fieldId\":\"$FIELD_ID\"}" \
  | jq '{statusCode, message, fieldId: .data.fieldId}'

# ─────────────────────────────────────────────────────
# STEP 5: Add skill
# ─────────────────────────────────────────────────────
echo ""
echo "▶ [5/8] Adding skill..."
curl -s -X POST "$BASE_URL/profile/skills" \
  -H "$JSON" -H "$AUTH" \
  -d "{\"skillId\":\"$SKILL_ID\",\"proficiency\":4}" \
  | jq '{statusCode, message, skillId: .data.skillId}'

# ─────────────────────────────────────────────────────
# STEP 6: Add language
# ─────────────────────────────────────────────────────
echo ""
echo "▶ [6/8] Adding language..."
curl -s -X POST "$BASE_URL/profile/languages" \
  -H "$JSON" -H "$AUTH" \
  -d "{\"languageId\":\"$LANG_ID\",\"proficiency\":\"Native\"}" \
  | jq '{statusCode, message, languageId: .data.languageId}'

# ─────────────────────────────────────────────────────
# STEP 7: Upload a document (requires dummy.pdf)
# ─────────────────────────────────────────────────────
echo ""
echo "▶ [7/8] Uploading document..."
if [ ! -f "dummy.pdf" ]; then
  echo "  ⚠️  dummy.pdf not found, creating a minimal valid PDF..."
  printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%%%EOF\n' > dummy.pdf
fi

UPLOAD=$(curl -s -X POST "$BASE_URL/profile/documents" \
  -H "$AUTH" \
  -F "docType=resume" \
  -F "file=@dummy.pdf")
echo "$UPLOAD" | jq '{statusCode, message, documentId: .data.id}'

# ─────────────────────────────────────────────────────
# STEP 8: Verify final profile
# ─────────────────────────────────────────────────────
echo ""
echo "▶ [8/8] Fetching final profile..."
curl -s "$BASE_URL/profile" -H "$AUTH" \
  | jq '{
      completionPct: .data.completionPct,
      coreFieldsComplete: .data.coreFieldsComplete,
      lastCompletedStep: .data.lastCompletedStep,
      isDraft: .data.isDraft,
      dateOfBirth: .data.dateOfBirth,
      nationality: .data.nationality,
      educationLevel: .data.educationLevel,
      skillsCount: (.data.skills | length),
      languagesCount: (.data.languages | length),
      fieldsCount: (.data.fieldsOfStudy | length),
      documentsCount: (.data.documents | length)
    }'

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Profile simulation complete"
echo "═══════════════════════════════════════════════════"
