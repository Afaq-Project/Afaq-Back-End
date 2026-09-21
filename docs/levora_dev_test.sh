#!/usr/bin/env bash
set -uo pipefail

# ================================================================
# Levora API - Full Endpoint Test Suite (Dev/Prod Server)
# Covers every endpoint in Levora_API.postman_collection.json
# ================================================================

# الافتراضي: سيرفر التطوير على Render
BASE_URL="${BASE_URL:-https://levora-back-end.onrender.com/api/v1}"
LOG_FILE="${LOG_FILE:-levora_dev_test_$(date +%Y%m%d_%H%M%S).txt}"

# اختبار Rate Limiting: معطّل افتراضيًا على prod (لتجنب حظر الـ IP)
RUN_RATE_LIMIT="${RUN_RATE_LIMIT:-0}"

# اختبارات admin: تحتاج بيانات اعتماد admin
SKIP_ADMIN_TESTS="${SKIP_ADMIN_TESTS:-1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

# مهلة curl (Render cold start يمكن أن يكون بطيئًا)
CURL_TIMEOUT="${CURL_TIMEOUT:-90}"

COUNTER_DIR="$(mktemp -d)"
DUMMY_PDF="$(mktemp --suffix=.pdf)"
trap 'rm -rf "$COUNTER_DIR" "$DUMMY_PDF"' EXIT

EMAIL="levora_test_$(date +%s)@example.com"
PASSWORD='P@ssw0rd123!'
FIRST_NAME="John"
LAST_NAME="Doe"

EMAIL_B="levora_test_b_$(date +%s)@example.com"
PASSWORD_B='P@ssw0rd456!'

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

command -v jq >/dev/null 2>&1 || { echo "❌ jq غير مثبت"; exit 1; }

# إنشاء PDF وهمي صالح (للاختبار)
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%%%EOF\n' > "$DUMMY_PDF"

# ================================================================
# العدّادات
# ================================================================
counter_inc() { local f="$COUNTER_DIR/$1"; local v=0; [[ -f "$f" ]] && v=$(cat "$f"); v=$((v+1)); echo "$v" > "$f"; echo "$v"; }
counter_get() { local f="$COUNTER_DIR/$1"; [[ -f "$f" ]] && cat "$f" || echo 0; }

# ================================================================
# التسجيل
# ================================================================
init_log() {
  {
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Levora API - Dev/Prod Test Report"
    echo "  Date   : $(date '+%Y-%m-%d %H:%M:%S')"
    echo "  BaseURL: $BASE_URL"
    echo "  Email A: $EMAIL"
    echo "  Email B: $EMAIL_B"
    echo "  RateLimit test: $RUN_RATE_LIMIT"
    echo "  Admin tests   : $([ "$SKIP_ADMIN_TESTS" = "1" ] && echo 'SKIPPED' || echo 'ENABLED')"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
  } > "$LOG_FILE"
}

log()      { echo "$*" >> "$LOG_FILE"; }
log_both() { echo -e "$*" | tee -a "$LOG_FILE"; }

log_section() {
  log ""; log "───────────────────────────────────────────────────────────────"
  log "  $1"; log "───────────────────────────────────────────────────────────────"; log ""
  echo -e "\n${BLUE}━━━ $1 ━━━${NC}" >&2
}

log_sub() { log ""; log "  ⋯ $1"; echo -e "${MAGENTA}  ⋯ $1${NC}" >&2; }

# ================================================================
# request(): stdout = body, stderr = human, log = كل التفاصيل
# ================================================================
request() {
  local method="$1" path="$2" data="${3:-}" token="${4:-}" expected="${5:-200}" desc="${6:-}"
  local n; n=$(counter_inc TOTAL)
  local url="${BASE_URL}${path}"
  local args=(-sS -X "$method" "$url" --max-time "$CURL_TIMEOUT" -w $'\n%{http_code}')
  local hdrs=()
  [[ -n "$token" ]] && hdrs+=(-H "Authorization: Bearer $token")
  [[ -n "$data" ]]  && { hdrs+=(-H "Content-Type: application/json"); args+=(-d "$data"); }
  args+=("${hdrs[@]}")

  log "▶ REQUEST #$n"
  log "  Method     : $method"
  log "  URL        : $url"
  [[ -n "$desc" ]]  && log "  Description: $desc"
  [[ -n "$token" ]] && log "  Auth       : Bearer ${token:0:30}..."
  [[ -n "$data" ]]  && log "  Body       : $data"
  log "  Expected   : HTTP $expected"; log ""

  local response
  if ! response="$(curl "${args[@]}" 2>&1)"; then
    counter_inc FAILED >/dev/null
    log "  ❌ CURL ERROR"; log ""
    echo -e "${RED}  ❌ #$n $method $path → فشل الاتصال${NC}" >&2
    return 1
  fi

  local body code
  body="${response%$'\n'*}"; code="${response##*$'\n'}"

  log "◀ RESPONSE"; log "  Status Code: $code"
  if [[ "$code" == "204" || -z "$body" ]]; then
    log "  Body       : (no content)"
  elif echo "$body" | jq . >/dev/null 2>&1; then
    log "  Body (JSON):"
    echo "$body" | jq . 2>/dev/null | sed 's/^/    /' >> "$LOG_FILE"
  else
    log "  Body (raw) : $body"
  fi
  log ""

  if [[ ",$expected," == *",$code,"* ]]; then
    counter_inc PASSED >/dev/null
    log "  ✅ PASS"; log ""
    echo -e "${GREEN}  ✅ #$n $method $path → $code${NC}" >&2
    printf '%s' "$body"; return 0
  else
    counter_inc FAILED >/dev/null
    log "  ❌ FAIL (expected $expected, got $code)"; log ""
    echo -e "${RED}  ❌ #$n $method $path → $code (متوقع: $expected)${NC}" >&2
    printf '%s' "$body"; return 1
  fi
}

# ================================================================
# request_multipart(): لرفع الملفات
# ================================================================
request_multipart() {
  local method="$1" path="$2" file_path="$3" doc_type="$4" token="${5:-}" expected="${6:-201}" desc="${7:-}"
  local n; n=$(counter_inc TOTAL)
  local url="${BASE_URL}${path}"

  log "▶ REQUEST #$n (multipart)"
  log "  Method     : $method"
  log "  URL        : $url"
  [[ -n "$desc" ]] && log "  Description: $desc"
  [[ -n "$token" ]] && log "  Auth       : Bearer ${token:0:30}..."
  log "  File       : $file_path"
  log "  docType    : $doc_type"
  log "  Expected   : HTTP $expected"; log ""

  local response
  if ! response="$(curl -sS -X "$method" "$url" \
      --max-time "$CURL_TIMEOUT" \
      -H "Authorization: Bearer $token" \
      -F "file=@${file_path}" \
      -F "docType=${doc_type}" \
      -w $'\n%{http_code}' 2>&1)"; then
    counter_inc FAILED >/dev/null
    log "  ❌ CURL ERROR"; log ""
    echo -e "${RED}  ❌ #$n $method $path → فشل الاتصال${NC}" >&2
    return 1
  fi

  local body code
  body="${response%$'\n'*}"; code="${response##*$'\n'}"

  log "◀ RESPONSE"; log "  Status Code: $code"
  if echo "$body" | jq . >/dev/null 2>&1; then
    log "  Body (JSON):"
    echo "$body" | jq . 2>/dev/null | sed 's/^/    /' >> "$LOG_FILE"
  else
    log "  Body (raw) : $body"
  fi
  log ""

  if [[ ",$expected," == *",$code,"* ]]; then
    counter_inc PASSED >/dev/null
    log "  ✅ PASS"; log ""
    echo -e "${GREEN}  ✅ #$n $method $path → $code${NC}" >&2
    printf '%s' "$body"; return 0
  else
    counter_inc FAILED >/dev/null
    log "  ❌ FAIL (expected $expected, got $code)"; log ""
    echo -e "${RED}  ❌ #$n $method $path → $code (متوقع: $expected)${NC}" >&2
    printf '%s' "$body"; return 1
  fi
}

# ================================================================
init_log

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  ${BLUE}Levora API - Full Endpoint Test${NC}"
echo -e "  Target : ${YELLOW}$BASE_URL${NC}"
echo -e "  Log    : ${YELLOW}$LOG_FILE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

# ================================================================
# 1) AUTH - Register / Login
# ================================================================
log_section "1) AUTH - Register & Login (User A)"

REGISTER_BODY=$(request POST "/auth/register" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"$FIRST_NAME\",\"lastName\":\"$LAST_NAME\"}" \
  "" "201" "Register user A")

USER_ID=$(echo "$REGISTER_BODY" | jq -r '.data.id // empty' 2>/dev/null)
log "  → userId A = $USER_ID"

LOGIN_BODY=$(request POST "/auth/login" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  "" "200" "Login user A")

ACCESS_TOKEN=$(echo "$LOGIN_BODY" | jq -r '.data.accessToken // empty' 2>/dev/null)
REFRESH_TOKEN=$(echo "$LOGIN_BODY" | jq -r '.data.refreshToken // empty' 2>/dev/null)

log "  → accessToken  = ${ACCESS_TOKEN:0:40}..."
log "  → refreshToken = ${REFRESH_TOKEN:0:40}..."

if [[ -z "$ACCESS_TOKEN" ]]; then
  log_both "${RED}❌ لا يوجد accessToken - توقف${NC}"; exit 1
fi

# ================================================================
# 2) AUTH - Me / Users Profile
# ================================================================
log_section "2) AUTH - Me & Users Profile"
request GET "/auth/me"        "" "$ACCESS_TOKEN" "200" "Current user via /auth/me" >/dev/null
request GET "/users/profile"  "" "$ACCESS_TOKEN" "200" "Own profile via /users/profile" >/dev/null

# ================================================================
# 3) REFERENCE DATA (Public)
# ================================================================
log_section "3) REFERENCE DATA (Public)"
request GET "/reference/fields-of-study"  "" "" "200" "Fields of study" >/dev/null
request GET "/reference/skills-taxonomy"  "" "" "200" "Skills taxonomy" >/dev/null
request GET "/reference/languages"        "" "" "200" "Languages master" >/dev/null
request GET "/reference/education-levels" "" "" "200" "Education levels" >/dev/null
request GET "/reference/app-languages"    "" "" "200" "App UI languages" >/dev/null

# استخراج IDs للاستخدام لاحقًا
SKILL_ID=$(request GET "/reference/skills-taxonomy" "" "" "200" "fetch skill id" 2>/dev/null | \
  jq -r '.. | objects | .id? // empty' 2>/dev/null | head -n1)
LANG_ID=$(request GET "/reference/languages" "" "" "200" "fetch language id" 2>/dev/null | \
  jq -r '.data[0].id // empty' 2>/dev/null)
EDU_LEVEL_ID=$(request GET "/reference/education-levels" "" "" "200" "fetch edu level id" 2>/dev/null | \
  jq -r '.data[0].id // empty' 2>/dev/null)
FOS_ID=$(request GET "/reference/fields-of-study" "" "" "200" "fetch fos id" 2>/dev/null | \
  jq -r '.data[0].id // empty' 2>/dev/null)

log "  → skillId     = $SKILL_ID"
log "  → languageId  = $LANG_ID"
log "  → eduLevelId  = $EDU_LEVEL_ID"
log "  → fieldOfStudy= $FOS_ID"

# ================================================================
# 4) PROFILE - Get / Update / Verify
# ================================================================
log_section "4) PROFILE - Get / Update / Verify"
request GET "/profile" "" "$ACCESS_TOKEN" "200" "Get profile" >/dev/null

request PATCH "/profile" \
  '{"fullName":"Jane Doe","experienceLevel":"Mid","hasFinancialNeed":false}' \
  "$ACCESS_TOKEN" "200" "Update basic fields" >/dev/null

VERIFY=$(request GET "/profile" "" "$ACCESS_TOKEN" "200" "Verify update")
NAME=$(echo "$VERIFY" | jq -r '.data.fullName // empty' 2>/dev/null)
log "  → fullName after update = $NAME"

# ================================================================
# 5) EDUCATIONS - Full CRUD
# ================================================================
log_section "5) PROFILE / EDUCATIONS - Full CRUD"

request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "List (empty)" >/dev/null

EDU_CREATE=$(request POST "/profile/educations" \
  '{"degree":"Bachelor of Science","major":"Computer Science","institution":"Technical University of Munich","graduationYear":2024}' \
  "$ACCESS_TOKEN" "201" "Create education")
EDU_ID=$(echo "$EDU_CREATE" | jq -r '.data.id // empty' 2>/dev/null)
log "  → educationId = $EDU_ID"

request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "List after create" >/dev/null

if [[ -n "$EDU_ID" ]]; then
  request PATCH "/profile/educations/$EDU_ID" \
    '{"gpaValue":3.8,"gpaScale":"4.0"}' \
    "$ACCESS_TOKEN" "200" "Update education (GPA)" >/dev/null
  request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "Verify update" >/dev/null
  request DELETE "/profile/educations/$EDU_ID" "" "$ACCESS_TOKEN" "200,204" "Delete education" >/dev/null
  request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "Verify delete" >/dev/null
  request DELETE "/profile/educations/$EDU_ID" "" "$ACCESS_TOKEN" "404" "Delete twice → 404" >/dev/null || true
fi

# ================================================================
# 6) SKILLS - Full CRUD
# ================================================================
log_section "6) PROFILE / SKILLS - Full CRUD"

SKILL_RECORD_ID=""
if [[ -n "$SKILL_ID" && "$SKILL_ID" != "null" ]]; then
  request GET "/profile/skills" "" "$ACCESS_TOKEN" "200" "List skills (empty)" >/dev/null

  SKILL_ADD=$(request POST "/profile/skills" \
    "{\"skillId\":\"$SKILL_ID\",\"proficiency\":4}" \
    "$ACCESS_TOKEN" "201" "Add skill")
  SKILL_RECORD_ID=$(echo "$SKILL_ADD" | jq -r '.data.skillId // empty' 2>/dev/null)
  log "  → skillRecordId = $SKILL_RECORD_ID"

  request GET "/profile/skills" "" "$ACCESS_TOKEN" "200" "List after add" >/dev/null
  request GET "/profile/skills/$SKILL_RECORD_ID" "" "$ACCESS_TOKEN" "200" "Get by ID" >/dev/null
  request PATCH "/profile/skills/$SKILL_RECORD_ID" '{"proficiency":5}' "$ACCESS_TOKEN" "200" "Update proficiency" >/dev/null
  request GET "/profile/skills/$SKILL_RECORD_ID" "" "$ACCESS_TOKEN" "200" "Verify update" >/dev/null
  request DELETE "/profile/skills/$SKILL_RECORD_ID" "" "$ACCESS_TOKEN" "200,204" "Delete skill" >/dev/null
  request GET "/profile/skills" "" "$ACCESS_TOKEN" "200" "Verify delete" >/dev/null
fi

# ================================================================
# 7) LANGUAGES - Full CRUD
# ================================================================
log_section "7) PROFILE / LANGUAGES - Full CRUD"

LANG_RECORD_ID=""
if [[ -n "$LANG_ID" && "$LANG_ID" != "null" ]]; then
  request GET "/profile/languages" "" "$ACCESS_TOKEN" "200" "List languages (empty)" >/dev/null

  LANG_ADD=$(request POST "/profile/languages" \
    "{\"languageId\":\"$LANG_ID\",\"proficiency\":\"Fluent\"}" \
    "$ACCESS_TOKEN" "201" "Add language")
  LANG_RECORD_ID=$(echo "$LANG_ADD" | jq -r '.data.languageId // empty' 2>/dev/null)
  log "  → languageRecordId = $LANG_RECORD_ID"

  request GET "/profile/languages" "" "$ACCESS_TOKEN" "200" "List after add" >/dev/null
  request GET "/profile/languages/$LANG_RECORD_ID" "" "$ACCESS_TOKEN" "200" "Get by ID" >/dev/null
  request PATCH "/profile/languages/$LANG_RECORD_ID" '{"proficiency":"Native"}' "$ACCESS_TOKEN" "200" "Update proficiency" >/dev/null
  request GET "/profile/languages/$LANG_RECORD_ID" "" "$ACCESS_TOKEN" "200" "Verify update" >/dev/null
  request DELETE "/profile/languages/$LANG_RECORD_ID" "" "$ACCESS_TOKEN" "200,204" "Delete language" >/dev/null
  request GET "/profile/languages" "" "$ACCESS_TOKEN" "200" "Verify delete" >/dev/null
fi

# ================================================================
# 8) DOCUMENTS - Full CRUD + Local Storage Download
# ================================================================
log_section "8) PROFILE / DOCUMENTS - Full CRUD + Storage"

DOC_ID=""
FILE_KEY=""
STORAGE_TOKEN=""

UPLOAD_BODY=$(request_multipart POST "/profile/documents" "$DUMMY_PDF" "resume" "$ACCESS_TOKEN" "201" "Upload PDF")
DOC_ID=$(echo "$UPLOAD_BODY" | jq -r '.data.id // empty' 2>/dev/null)
log "  → documentId = $DOC_ID"

request GET "/profile/documents" "" "$ACCESS_TOKEN" "200" "List documents" >/dev/null

if [[ -n "$DOC_ID" ]]; then
  DOWNLOAD_BODY=$(request GET "/profile/documents/$DOC_ID/download" "" "$ACCESS_TOKEN" "200" "Get download URL")
  URL=$(echo "$DOWNLOAD_BODY" | jq -r '.data.url // empty' 2>/dev/null)
  log "  → download URL = $URL"

  if [[ -n "$URL" ]]; then
    STORAGE_TOKEN=$(echo "$URL" | sed -n 's/.*token=\([^&]*\).*/\1/p')
    FILE_KEY=$(echo "${URL%%\?*}" | awk -F/ '{print $NF}')
    log "  → fileKey = $FILE_KEY"
    log "  → token   = ${STORAGE_TOKEN:0:30}..."
  fi

  # اختبار local storage download (نفس المسار الذي في Postman)
  if [[ -n "$FILE_KEY" && -n "$STORAGE_TOKEN" ]]; then
    log_sub "Local Storage download"
    request GET "/local-storage/${FILE_KEY}?token=${STORAGE_TOKEN}" \
      "" "" "200" "Download file from local storage" >/dev/null || true
  fi

  # اختبار رفع ملف مرفوض (exe.jpg)
  log_sub "Upload rejected type (.exe disguised)"
  BAD_FILE="$(mktemp --suffix=.pdf)"
  printf 'MZfakeexecutable' > "$BAD_FILE"
  request_multipart POST "/profile/documents" "$BAD_FILE" "resume" "$ACCESS_TOKEN" "400" "Reject fake PDF" >/dev/null || true
  rm -f "$BAD_FILE"

  # حذف المستند
  request DELETE "/profile/documents/$DOC_ID" "" "$ACCESS_TOKEN" "200,204" "Delete document" >/dev/null
  request GET "/profile/documents" "" "$ACCESS_TOKEN" "200" "Verify delete" >/dev/null
fi

# ================================================================
# 9) PROFILE PUBLISH FLOW
# ================================================================
log_section "9) PROFILE - Complete Core Fields & Publish"

PATCH_BODY=$(jq -n \
  --arg fullName "Jane Doe" \
  --arg dob "1995-05-15" \
  --arg nat "Jordanian" \
  --arg edu "$EDU_LEVEL_ID" \
  --arg fos "$FOS_ID" \
  --arg cc "Jordan" \
  --arg city "Amman" \
  --arg phone "+962791234567" \
  --arg exp "Mid" \
  '{fullName:$fullName, dateOfBirth:$dob, nationality:$nat, educationLevel:$edu,
    fieldOfStudy:[$fos], currentCountry:$cc, currentCity:$city,
    phone:$phone, experienceLevel:$exp, hasFinancialNeed:false}')

request PATCH "/profile" "$PATCH_BODY" "$ACCESS_TOKEN" "200" "Complete core fields" >/dev/null

CORE=$(request GET "/profile" "" "$ACCESS_TOKEN" "200" "Check coreFieldsComplete")
CORE_STATUS=$(echo "$CORE" | jq -r '.data.coreFieldsComplete // empty' 2>/dev/null)
log "  → coreFieldsComplete = $CORE_STATUS"

request POST "/profile/publish" "" "$ACCESS_TOKEN" "200" "Publish profile" >/dev/null

PUB_VERIFY=$(request GET "/profile" "" "$ACCESS_TOKEN" "200" "Verify isDraft=false")
IS_DRAFT=$(echo "$PUB_VERIFY" | jq -r '.data.isDraft // empty' 2>/dev/null)
log "  → isDraft = $IS_DRAFT"

request POST "/profile/publish" "" "$ACCESS_TOKEN" "409" "Publish twice → 409" >/dev/null || true

# ================================================================
# 10) USERS (Admin) - Negative check for regular user
# ================================================================
log_section "10) USERS (Admin) - RBAC check"
request GET "/users?page=1&limit=20" "" "$ACCESS_TOKEN" "403" "Regular user cannot list users" >/dev/null || true
request GET "/users/$USER_ID" "" "$ACCESS_TOKEN" "403,200" "Regular user get by ID" >/dev/null || true

if [[ "$SKIP_ADMIN_TESTS" != "1" && -n "$ADMIN_EMAIL" && -n "$ADMIN_PASSWORD" ]]; then
  log_sub "Admin login + admin endpoints"
  ADMIN_LOGIN=$(request POST "/auth/login" \
    "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
    "" "200" "Admin login")
  ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.accessToken // empty' 2>/dev/null)

  if [[ -n "$ADMIN_TOKEN" ]]; then
    request GET "/users?page=1&limit=20" "" "$ADMIN_TOKEN" "200" "Admin: list users" >/dev/null
    request GET "/users/$USER_ID" "" "$ADMIN_TOKEN" "200" "Admin: get user by ID" >/dev/null
  fi
fi

# ================================================================
# 11) OAUTH - Initiate (Google + LinkedIn)
# ================================================================
log_section "11) OAUTH - Initiate (302 redirects)"
request GET "/auth/google"   "" "" "302" "Google OAuth redirect"   >/dev/null || true
request GET "/auth/linkedin" "" "" "302" "LinkedIn OAuth redirect" >/dev/null || true

# Callbacks without code → should reject
log_sub "OAuth callbacks without code"
request GET "/auth/google/callback"   "" "" "400,401,302" "Google callback no code"   >/dev/null || true
request GET "/auth/linkedin/callback" "" "" "400,401,302" "LinkedIn callback no code" >/dev/null || true

# ================================================================
# 12) REFRESH TOKEN
# ================================================================
log_section "12) AUTH - Refresh Token"
REFRESH_BODY=$(request POST "/auth/refresh" \
  "{\"refreshToken\":\"$REFRESH_TOKEN\"}" \
  "" "200" "Refresh access token")

NEW_ACCESS=$(echo "$REFRESH_BODY" | jq -r '.data.accessToken // empty' 2>/dev/null)
NEW_REFRESH=$(echo "$REFRESH_BODY" | jq -r '.data.refreshToken // empty' 2>/dev/null)

if [[ -n "$NEW_ACCESS" ]]; then
  ACCESS_TOKEN="$NEW_ACCESS"
  REFRESH_TOKEN="$NEW_REFRESH"
  log "  → accessToken rotated"
fi

# ================================================================
# 13) HEALTH
# ================================================================
log_section "13) HEALTH"
request GET "/health"       "" "" "200" "Liveness"  >/dev/null
request GET "/health/ready" "" "" "200" "Readiness" >/dev/null

# ================================================================
# 14) SECURITY - Negative Tests
# ================================================================
log_section "14) SECURITY - Negative Tests"

log_sub "14.1 Duplicate register"
request POST "/auth/register" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"$FIRST_NAME\",\"lastName\":\"$LAST_NAME\"}" \
  "" "400,409" "Duplicate email" >/dev/null || true

log_sub "14.2 Register missing fields"
request POST "/auth/register" '{"email":"incomplete@levora.com"}' \
  "" "400" "Missing password" >/dev/null || true

log_sub "14.3 Wrong password"
request POST "/auth/login" \
  "{\"email\":\"$EMAIL\",\"password\":\"WrongPassword!\"}" \
  "" "401" "Invalid credentials" >/dev/null || true

log_sub "14.4 No token"
request GET "/profile" "" "" "401" "Missing auth" >/dev/null || true

log_sub "14.5 Invalid token"
request GET "/profile" "" "invalid.token.here" "401" "Invalid token" >/dev/null || true

log_sub "14.6 Invalid refresh token"
request POST "/auth/refresh" '{"refreshToken":"invalid.refresh.token"}' \
  "" "401" "Invalid refresh" >/dev/null || true

log_sub "14.7 Weak password"
request POST "/auth/register" \
  '{"email":"weak_'$(date +%s)'@levora.com","password":"123","firstName":"W","lastName":"P"}' \
  "" "400" "Weak password" >/dev/null || true

log_sub "14.8 Bad email format"
request POST "/auth/register" \
  '{"email":"not-an-email","password":"P@ssw0rd123!","firstName":"B","lastName":"E"}' \
  "" "400" "Invalid email" >/dev/null || true

log_sub "14.9 proficiency = 6"
request POST "/profile/skills" \
  "{\"skillId\":\"$SKILL_ID\",\"proficiency\":6}" \
  "$ACCESS_TOKEN" "400" "Proficiency > 5" >/dev/null || true

log_sub "14.10 proficiency = -1"
request POST "/profile/skills" \
  "{\"skillId\":\"$SKILL_ID\",\"proficiency\":-1}" \
  "$ACCESS_TOKEN" "400" "Proficiency < 1" >/dev/null || true

log_sub "14.11 UUID صفري (IDOR)"
request GET "/profile/skills/00000000-0000-0000-0000-000000000000" \
  "" "$ACCESS_TOKEN" "403,404" "Zero UUID" >/dev/null || true

log_sub "14.12 Pagination page=9999"
request GET "/profile/skills?page=9999&limit=20" "" "$ACCESS_TOKEN" "200" "Deep page" >/dev/null || true

log_sub "14.13 page=0"
request GET "/profile/educations?page=0" "" "$ACCESS_TOKEN" "400" "page=0" >/dev/null || true

log_sub "14.14 limit=1000"
request GET "/profile/educations?limit=1000" "" "$ACCESS_TOKEN" "400" "limit too large" >/dev/null || true

# ================================================================
# 15) REAL IDOR - User B
# ================================================================
log_section "15) SECURITY - Real IDOR (User B)"

REG_B=$(request POST "/auth/register" \
  "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD_B\",\"firstName\":\"Bob\",\"lastName\":\"Smith\"}" \
  "" "201" "Register user B")

LOG_B=$(request POST "/auth/login" \
  "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD_B\"}" \
  "" "200" "Login user B")
TOKEN_B=$(echo "$LOG_B" | jq -r '.data.accessToken // empty' 2>/dev/null)
log "  → accessToken B = ${TOKEN_B:0:40}..."

# User A ينشئ موارد
SKILL_A=$(request POST "/profile/skills" \
  "{\"skillId\":\"$SKILL_ID\",\"proficiency\":3}" \
  "$ACCESS_TOKEN" "201" "User A: add skill")
SKILL_A_ID=$(echo "$SKILL_A" | jq -r '.data.skillId // empty' 2>/dev/null)

EDU_A=$(request POST "/profile/educations" \
  '{"degree":"BSc","major":"Physics","institution":"A University","graduationYear":2020}' \
  "$ACCESS_TOKEN" "201" "User A: add education")
EDU_A_ID=$(echo "$EDU_A" | jq -r '.data.id // empty' 2>/dev/null)

LANG_A=$(request POST "/profile/languages" \
  "{\"languageId\":\"$LANG_ID\",\"proficiency\":\"Basic\"}" \
  "$ACCESS_TOKEN" "201" "User A: add language")
LANG_A_ID=$(echo "$LANG_A" | jq -r '.data.languageId // empty' 2>/dev/null)

if [[ -n "$TOKEN_B" ]]; then
  log_sub "IDOR on Skills"
  request GET    "/profile/skills/$SKILL_A_ID"         "" "$TOKEN_B" "403,404" "B reads A's skill"   >/dev/null || true
  request PATCH  "/profile/skills/$SKILL_A_ID" '{"proficiency":2}' "$TOKEN_B" "403,404" "B updates A's skill" >/dev/null || true
  request DELETE "/profile/skills/$SKILL_A_ID"         "" "$TOKEN_B" "403,404" "B deletes A's skill" >/dev/null || true

  log_sub "IDOR on Educations"
  request GET    "/profile/educations/$EDU_A_ID" "" "$TOKEN_B" "403,404,405" "B reads A's edu"   >/dev/null || true
  request PATCH  "/profile/educations/$EDU_A_ID" '{"degree":"Hacked"}' "$TOKEN_B" "403,404" "B updates A's edu" >/dev/null || true
  request DELETE "/profile/educations/$EDU_A_ID" "" "$TOKEN_B" "403,404" "B deletes A's edu" >/dev/null || true

  log_sub "IDOR on Languages"
  request GET    "/profile/languages/$LANG_A_ID" "" "$TOKEN_B" "403,404,405" "B reads A's lang"   >/dev/null || true
  request PATCH  "/profile/languages/$LANG_A_ID" '{"proficiency":"Native"}' "$TOKEN_B" "403,404" "B updates A's lang" >/dev/null || true
  request DELETE "/profile/languages/$LANG_A_ID" "" "$TOKEN_B" "403,404" "B deletes A's lang" >/dev/null || true
fi

# تنظيف موارد A
[[ -n "$EDU_A_ID"  ]] && request DELETE "/profile/educations/$EDU_A_ID" "" "$ACCESS_TOKEN" "200,204" "cleanup edu A"  >/dev/null || true
[[ -n "$LANG_A_ID" ]] && request DELETE "/profile/languages/$LANG_A_ID" "" "$ACCESS_TOKEN" "200,204" "cleanup lang A" >/dev/null || true
[[ -n "$SKILL_A_ID" ]] && request DELETE "/profile/skills/$SKILL_A_ID"   "" "$ACCESS_TOKEN" "200,204" "cleanup skill A" >/dev/null || true

# ================================================================
# 16) RATE LIMITING (اختياري - معطّل افتراضيًا على prod)
# ================================================================
if [[ "$RUN_RATE_LIMIT" == "1" ]]; then
  log_section "16) SECURITY - Rate Limiting (15 attempts)"
  RATE_HIT=0
  for i in $(seq 1 15); do
    resp=$(request POST "/auth/login" \
      '{"email":"ratelimit@levora.com","password":"x"}' \
      "" "401,429" "Rate limit #$i" 2>/dev/null) || true
    code=$(echo "$resp" | jq -r '.status // empty' 2>/dev/null)
    if [[ "$code" == "429" ]]; then
      RATE_HIT=1; log "  → 429 at attempt #$i"; break
    fi
  done
  [[ "$RATE_HIT" == "1" ]] && log "  ✅ Rate limiting works" || log "  ⚠️  Not triggered in 15 attempts"
else
  log_section "16) Rate Limiting - SKIPPED (set RUN_RATE_LIMIT=1 to enable)"
fi

# ================================================================
# 17) LOGOUT + Post-Logout checks
# ================================================================
log_section "17) AUTH - Logout"

request POST "/auth/logout" "" "$ACCESS_TOKEN" "200,204" "Logout user A" >/dev/null

log_sub "17.b accessToken after logout"
request GET "/profile" "" "$ACCESS_TOKEN" "401,403" "Access after logout" >/dev/null || true

log_sub "17.c refreshToken after logout"
request POST "/auth/refresh" \
  "{\"refreshToken\":\"$REFRESH_TOKEN\"}" \
  "" "401,403" "Refresh after logout" >/dev/null || true

# ================================================================
# SUMMARY
# ================================================================
TOTAL=$(counter_get TOTAL); PASSED=$(counter_get PASSED); FAILED=$(counter_get FAILED)

log ""
log "═══════════════════════════════════════════════════════════════"
log "  SUMMARY"; log "═══════════════════════════════════════════════════════════════"
log "  Total  : $TOTAL"; log "  Passed : $PASSED"; log "  Failed : $FAILED"
log "═══════════════════════════════════════════════════════════════"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  ${BLUE}SUMMARY${NC}"
echo -e "  Total  : $TOTAL"
echo -e "  ${GREEN}Passed : $PASSED ✅${NC}"
if [[ "$FAILED" -gt 0 ]]; then
  echo -e "  ${RED}Failed : $FAILED ❌${NC}"
else
  echo -e "  Failed : 0"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  📄 Log file: ${YELLOW}$LOG_FILE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
