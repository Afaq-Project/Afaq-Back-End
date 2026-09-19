#!/usr/bin/env bash
set -uo pipefail

# ================================================================
# Levora API - Full Test Suite with File Logging
# ================================================================

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
LOG_FILE="${LOG_FILE:-levora_test_log_$(date +%Y%m%d_%H%M%S).txt}"

COUNTER_DIR="$(mktemp -d)"
trap 'rm -rf "$COUNTER_DIR"' EXIT

EMAIL="levora_test_$(date +%s)@example.com"
PASSWORD='P@ssw0rd123!'
FIRST_NAME="John"
LAST_NAME="Doe"

EMAIL_B="levora_test_b_$(date +%s)@example.com"
PASSWORD_B='P@ssw0rd456!'

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq غير مثبت. ثبته بالأمر: sudo apt install -y jq"
  exit 1
fi

counter_inc() {
  local name="$1"
  local file="$COUNTER_DIR/$name"
  local val=0
  [[ -f "$file" ]] && val=$(cat "$file")
  val=$((val + 1))
  echo "$val" > "$file"
  echo "$val"
}

counter_get() {
  local file="$COUNTER_DIR/$1"
  [[ -f "$file" ]] && cat "$file" || echo 0
}

init_log() {
  {
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Levora API - Test Report"
    echo "  Date   : $(date '+%Y-%m-%d %H:%M:%S')"
    echo "  BaseURL: $BASE_URL"
    echo "  Email A: $EMAIL"
    echo "  Email B: $EMAIL_B"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
  } > "$LOG_FILE"
}

log()      { echo "$*" >> "$LOG_FILE"; }
log_both() { echo -e "$*" | tee -a "$LOG_FILE"; }

log_section() {
  log ""
  log "───────────────────────────────────────────────────────────────"
  log "  $1"
  log "───────────────────────────────────────────────────────────────"
  log ""
  echo -e "\n${BLUE}━━━ $1 ━━━${NC}" >&2
}

log_sub() {
  log ""
  log "  ⋯ $1"
  echo -e "${MAGENTA}  ⋯ $1${NC}" >&2
}

# ================================================================
# request: stdout = body only, stderr = human messages
# ================================================================
request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local token="${4:-}"
  local expected="${5:-200}"
  local description="${6:-}"

  local n
  n=$(counter_inc TOTAL)

  local url="${BASE_URL}${path}"
  local args=(-sS -X "$method" "$url" -w $'\n%{http_code}')
  local curl_headers=()

  if [[ -n "$token" ]]; then
    curl_headers+=(-H "Authorization: Bearer $token")
  fi
  if [[ -n "$data" ]]; then
    curl_headers+=(-H "Content-Type: application/json")
    args+=(-d "$data")
  fi
  args+=("${curl_headers[@]}")

  log "▶ REQUEST #$n"
  log "  Method     : $method"
  log "  URL        : $url"
  [[ -n "$description" ]] && log "  Description: $description"
  [[ -n "$token" ]] && log "  Auth       : Bearer ${token:0:30}..."
  [[ -n "$data" ]] && log "  Body       : $data"
  log "  Expected   : HTTP $expected"
  log ""

  local response
  if ! response="$(curl "${args[@]}")"; then
    counter_inc FAILED >/dev/null
    log "  ❌ CURL ERROR"
    log ""
    echo -e "${RED}  ❌ #$n $method $path → فشل الاتصال${NC}" >&2
    return 1
  fi

  local body code
  body="${response%$'\n'*}"
  code="${response##*$'\n'}"

  log "◀ RESPONSE"
  log "  Status Code: $code"
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
    log "  ✅ PASS"
    log ""
    echo -e "${GREEN}  ✅ #$n $method $path → $code${NC}" >&2
    printf '%s' "$body"
    return 0
  else
    counter_inc FAILED >/dev/null
    log "  ❌ FAIL (expected $expected, got $code)"
    log ""
    echo -e "${RED}  ❌ #$n $method $path → $code (متوقع: $expected)${NC}" >&2
    printf '%s' "$body"
    return 1
  fi
}

init_log

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════"
echo "  Levora API - Full Test Suite"
echo "  Log: $LOG_FILE"
echo "═══════════════════════════════════════════════════"
echo -e "${NC}"

# ================================================================
# 1) AUTH - Register (User A)
# ================================================================
log_section "1) AUTH - Register (User A)"
REGISTER_BODY=$(request POST "/auth/register" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"$FIRST_NAME\",\"lastName\":\"$LAST_NAME\"}" \
  "" "201" "تسجيل المستخدم A")

USER_ID=$(echo "$REGISTER_BODY" | jq -r '.data.id // empty' 2>/dev/null)
log "  → userId A = $USER_ID"

# ================================================================
# 2) AUTH - Login (User A)
# ================================================================
log_section "2) AUTH - Login (User A)"
LOGIN_BODY=$(request POST "/auth/login" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  "" "200" "تسجيل دخول A")

ACCESS_TOKEN=$(echo "$LOGIN_BODY" | jq -r '.data.accessToken // empty' 2>/dev/null)
REFRESH_TOKEN=$(echo "$LOGIN_BODY" | jq -r '.data.refreshToken // empty' 2>/dev/null)

log "  → accessToken  = ${ACCESS_TOKEN:0:40}..."
log "  → refreshToken = ${REFRESH_TOKEN:0:40}..."

if [[ -z "$ACCESS_TOKEN" ]]; then
  log_both "${RED}❌ لم يتم الحصول على accessToken - توقف${NC}"
  exit 1
fi

# ================================================================
# 3) AUTH - Me
# ================================================================
log_section "3) AUTH - Me"
request GET "/auth/me" "" "$ACCESS_TOKEN" "200" "الملف الشخصي الحالي" >/dev/null

# ================================================================
# 4) USERS - Own Profile
# ================================================================
log_section "4) USERS - Get Own Profile"
request GET "/users/profile" "" "$ACCESS_TOKEN" "200" "بروفايل المستخدم الحالي" >/dev/null

# ================================================================
# 5) PROFILE - Get
# ================================================================
log_section "5) PROFILE - Get User Profile"
request GET "/profile" "" "$ACCESS_TOKEN" "200" "استرجاع البروفايل" >/dev/null

# ================================================================
# 6) PROFILE - Update + Verify
# ================================================================
log_section "6) PROFILE - Update"
request PATCH "/profile" \
  '{"fullName":"Jane Doe","experienceLevel":"Mid","hasFinancialNeed":false}' \
  "$ACCESS_TOKEN" "200" "تحديث البروفايل" >/dev/null

log_section "6.b) PROFILE - Verify Update"
VERIFY_BODY=$(request GET "/profile" "" "$ACCESS_TOKEN" "200" "التحقق من التحديث")
UPDATED_NAME=$(echo "$VERIFY_BODY" | jq -r '.data.fullName // empty' 2>/dev/null)
log "  → fullName بعد التحديث: $UPDATED_NAME"
if [[ "$UPDATED_NAME" == "Jane Doe" ]]; then
  log "  ✅ التحديث تم بنجاح"
else
  log "  ⚠️  fullName لم يتحدث كما هو متوقع"
fi

# ================================================================
# 7) EDUCATIONS - Full CRUD
# ================================================================
log_section "7) PROFILE / EDUCATIONS - Full CRUD"

request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "قائمة التعليمات (فارغة)" >/dev/null

EDU_CREATE_BODY=$(request POST "/profile/educations" \
  '{"degree":"Bachelor of Science","major":"Computer Science","institution":"Technical University of Munich","graduationYear":2024}' \
  "$ACCESS_TOKEN" "201" "إنشاء سجل تعليمي")

EDU_ID=$(echo "$EDU_CREATE_BODY" | jq -r '.data.id // empty' 2>/dev/null)
log "  → educationId = $EDU_ID"

request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "قائمة التعليمات بعد الإضافة" >/dev/null

if [[ -n "$EDU_ID" ]]; then
  request PATCH "/profile/educations/$EDU_ID" \
    '{"gpaValue":3.8,"gpaScale":"4.0"}' \
    "$ACCESS_TOKEN" "200" "تحديث السجل التعليمي" >/dev/null

  request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "التحقق من التحديث" >/dev/null

  request DELETE "/profile/educations/$EDU_ID" "" "$ACCESS_TOKEN" "200,204" "حذف السجل التعليمي" >/dev/null

  request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "التحقق من الحذف" >/dev/null

  log_sub "Delete education twice (يجب 404)"
  request DELETE "/profile/educations/$EDU_ID" "" "$ACCESS_TOKEN" "404" "حذف سجل محذوف" >/dev/null || true
fi

# ================================================================
# 8) SKILLS - Full CRUD
# ================================================================
log_section "8) PROFILE / SKILLS - Full CRUD"

TAXONOMY_BODY=$(request GET "/reference/skills-taxonomy" "" "" "200" "جلب تصنيف المهارات")

SKILL_ID=$(echo "$TAXONOMY_BODY" | jq -r '.. | objects | .id? // .skillId? // empty' 2>/dev/null | head -n1)
if [[ -z "$SKILL_ID" || "$SKILL_ID" == "null" ]]; then
  SKILL_ID=$(echo "$TAXONOMY_BODY" | grep -oE '[0-9a-fA-F-]{36}' | head -n1 || true)
fi
log "  → skillId = $SKILL_ID"

if [[ -n "$SKILL_ID" && "$SKILL_ID" != "null" ]]; then
  request GET "/profile/skills" "" "$ACCESS_TOKEN" "200" "قائمة المهارات (فارغة)" >/dev/null

  SKILL_ADD_BODY=$(request POST "/profile/skills" \
    "{\"skillId\":\"$SKILL_ID\",\"proficiency\":4}" \
    "$ACCESS_TOKEN" "201" "إضافة مهارة")

  SKILL_RECORD_ID=$(echo "$SKILL_ADD_BODY" | jq -r '.data.skillId // .data.id // empty' 2>/dev/null)
  log "  → skillRecordId = $SKILL_RECORD_ID"

  request GET "/profile/skills" "" "$ACCESS_TOKEN" "200" "قائمة المهارات بعد الإضافة" >/dev/null

  if [[ -n "$SKILL_RECORD_ID" ]]; then
    request GET "/profile/skills/$SKILL_RECORD_ID" "" "$ACCESS_TOKEN" "200" "جلب مهارة بالـ ID" >/dev/null
    request PATCH "/profile/skills/$SKILL_RECORD_ID" '{"proficiency":5}' "$ACCESS_TOKEN" "200" "تحديث المهارة" >/dev/null
    request GET "/profile/skills/$SKILL_RECORD_ID" "" "$ACCESS_TOKEN" "200" "التحقق من التحديث" >/dev/null
    request DELETE "/profile/skills/$SKILL_RECORD_ID" "" "$ACCESS_TOKEN" "200,204" "حذف المهارة" >/dev/null
    request GET "/profile/skills" "" "$ACCESS_TOKEN" "200" "التحقق من الحذف" >/dev/null
  fi
fi

# ================================================================
# 9) LANGUAGES - Full CRUD
# ================================================================
log_section "9) PROFILE / LANGUAGES - Full CRUD"

LANG_REF_BODY=$(request GET "/reference/languages" "" "" "200" "جلب قائمة اللغات")

LANG_ID=$(echo "$LANG_REF_BODY" | jq -r '.. | objects | .id? // .languageId? // empty' 2>/dev/null | head -n1)
if [[ -z "$LANG_ID" || "$LANG_ID" == "null" ]]; then
  LANG_ID=$(echo "$LANG_REF_BODY" | grep -oE '[0-9a-fA-F-]{36}' | head -n1 || true)
fi
log "  → languageId = $LANG_ID"

if [[ -n "$LANG_ID" && "$LANG_ID" != "null" ]]; then
  request GET "/profile/languages" "" "$ACCESS_TOKEN" "200" "قائمة اللغات (فارغة)" >/dev/null

  LANG_ADD_BODY=$(request POST "/profile/languages" \
    "{\"languageId\":\"$LANG_ID\",\"proficiency\":\"Fluent\"}" \
    "$ACCESS_TOKEN" "201" "إضافة لغة")

  LANG_RECORD_ID=$(echo "$LANG_ADD_BODY" | jq -r '.data.languageId // .data.id // empty' 2>/dev/null)
  log "  → languageRecordId = $LANG_RECORD_ID"

  request GET "/profile/languages" "" "$ACCESS_TOKEN" "200" "قائمة اللغات بعد الإضافة" >/dev/null

  if [[ -n "$LANG_RECORD_ID" ]]; then
    request GET "/profile/languages/$LANG_RECORD_ID" "" "$ACCESS_TOKEN" "200" "جلب لغة بالـ ID" >/dev/null
    request PATCH "/profile/languages/$LANG_RECORD_ID" '{"proficiency":"Native"}' "$ACCESS_TOKEN" "200" "تحديث اللغة" >/dev/null
    request GET "/profile/languages/$LANG_RECORD_ID" "" "$ACCESS_TOKEN" "200" "التحقق من التحديث" >/dev/null
    request DELETE "/profile/languages/$LANG_RECORD_ID" "" "$ACCESS_TOKEN" "200,204" "حذف اللغة" >/dev/null
    request GET "/profile/languages" "" "$ACCESS_TOKEN" "200" "التحقق من الحذف" >/dev/null
  fi
fi

# ================================================================
# 10) REFERENCE DATA
# ================================================================
log_section "10) REFERENCE DATA"
request GET "/reference/fields-of-study" "" "" "200" "مجالات الدراسة" >/dev/null
request GET "/reference/skills-taxonomy"   "" "" "200" "تصنيف المهارات" >/dev/null
request GET "/reference/languages"         "" "" "200" "اللغات" >/dev/null
request GET "/reference/education-levels"  "" "" "200" "مستويات التعليم" >/dev/null
request GET "/reference/app-languages"     "" "" "200" "لغات التطبيق" >/dev/null

# ================================================================
# 11) REFRESH TOKEN
# ================================================================
log_section "11) AUTH - Refresh Token"
REFRESH_BODY=$(request POST "/auth/refresh" \
  "{\"refreshToken\":\"$REFRESH_TOKEN\"}" \
  "" "200" "تحديث التوكن")

NEW_ACCESS=$(echo "$REFRESH_BODY" | jq -r '.data.accessToken // empty' 2>/dev/null)
NEW_REFRESH=$(echo "$REFRESH_BODY" | jq -r '.data.refreshToken // empty' 2>/dev/null)

if [[ -n "$NEW_ACCESS" ]]; then
  ACCESS_TOKEN="$NEW_ACCESS"
  REFRESH_TOKEN="$NEW_REFRESH"
  log "  → التوكن تم تحديثه"
fi

# ================================================================
# 12) HEALTH
# ================================================================
log_section "12) HEALTH"
request GET "/health"       "" "" "200" "Liveness"  >/dev/null
request GET "/health/ready" "" "" "200" "Readiness" >/dev/null

# ================================================================
# 13) SECURITY - Negative Tests
# ================================================================
log_section "13) SECURITY - Negative Tests"

log_sub "13.1 تسجيل بنفس الإيميل مرة ثانية"
request POST "/auth/register" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"$FIRST_NAME\",\"lastName\":\"$LAST_NAME\"}" \
  "" "400,409" "Duplicate register" >/dev/null || true

log_sub "13.2 تسجيل بحقول ناقصة"
request POST "/auth/register" \
  '{"email":"incomplete@levora.com"}' \
  "" "400" "Register missing fields" >/dev/null || true

log_sub "13.3 Login بكلمة سر خاطئة"
request POST "/auth/login" \
  "{\"email\":\"$EMAIL\",\"password\":\"WrongPassword!\"}" \
  "" "401" "Login invalid password" >/dev/null || true

log_sub "13.4 الوصول لـ endpoint محمي بدون توكن"
request GET "/profile" "" "" "401" "No token" >/dev/null || true

log_sub "13.5 الوصول بتوكن غير صالح"
request GET "/profile" "" "invalid.token.here" "401" "Invalid token" >/dev/null || true

log_sub "13.6 Refresh بتوكن غير صالح"
request POST "/auth/refresh" \
  '{"refreshToken":"invalid.refresh.token"}' \
  "" "401" "Invalid refresh token" >/dev/null || true

log_sub "13.7 IDOR - UUID صفري"
request GET "/profile/skills/00000000-0000-0000-0000-000000000000" \
  "" "$ACCESS_TOKEN" "403,404" "IDOR zero UUID" >/dev/null || true

log_sub "13.8 Pagination - page كبير"
request GET "/profile/skills?page=9999&limit=20" "" "$ACCESS_TOKEN" "200" "Pagination page=9999" >/dev/null || true

# ================================================================
# 14) SECURITY - Real IDOR (Skills)
# ================================================================
log_section "14) SECURITY - Real IDOR Test (Skills)"

log_sub "14.1 Register User B"
REGISTER_B=$(request POST "/auth/register" \
  "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD_B\",\"firstName\":\"Bob\",\"lastName\":\"Smith\"}" \
  "" "201" "تسجيل المستخدم B")

USER_B_ID=$(echo "$REGISTER_B" | jq -r '.data.id // empty' 2>/dev/null)
log "  → userId B = $USER_B_ID"

log_sub "14.2 Login User B"
LOGIN_B=$(request POST "/auth/login" \
  "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD_B\"}" \
  "" "200" "تسجيل دخول B")

ACCESS_TOKEN_B=$(echo "$LOGIN_B" | jq -r '.data.accessToken // empty' 2>/dev/null)
log "  → accessToken B = ${ACCESS_TOKEN_B:0:40}..."

log_sub "14.3 User A ينشئ skill"
SKILL_A_BODY=$(request POST "/profile/skills" \
  "{\"skillId\":\"$SKILL_ID\",\"proficiency\":3}" \
  "$ACCESS_TOKEN" "201" "User A skill")

SKILL_A_ID=$(echo "$SKILL_A_BODY" | jq -r '.data.skillId // .data.id // empty' 2>/dev/null)
log "  → skill A id = $SKILL_A_ID"

if [[ -n "$SKILL_A_ID" && -n "$ACCESS_TOKEN_B" ]]; then
  log_sub "14.4 IDOR: User B يحاول قراءة مهارة User A"
  request GET "/profile/skills/$SKILL_A_ID" \
    "" "$ACCESS_TOKEN_B" "403,404" "IDOR: B reads A's skill" >/dev/null || true

  log_sub "14.5 IDOR: User B يحاول تحديث مهارة User A"
  request PATCH "/profile/skills/$SKILL_A_ID" \
    '{"proficiency":2}' \
    "$ACCESS_TOKEN_B" "403,404" "IDOR: B updates A's skill" >/dev/null || true

  log_sub "14.6 IDOR: User B يحاول حذف مهارة User A"
  request DELETE "/profile/skills/$SKILL_A_ID" \
    "" "$ACCESS_TOKEN_B" "403,404" "IDOR: B deletes A's skill" >/dev/null || true
fi

# ================================================================
# 15) PROFILE - Complete Core Fields & Publish
# ================================================================
log_section "15) PROFILE - Complete Core Fields & Publish"

log_sub "15.0 جلب مجال الدراسة (مطلوب لـ coreFieldsComplete)"
FOS_BODY=$(request GET "/reference/fields-of-study" "" "" "200" "جلب مجالات الدراسة")

FOS_ID=$(echo "$FOS_BODY" | jq -r '.data[0].id // .data[0].data[0].id // empty' 2>/dev/null)
if [[ -z "$FOS_ID" || "$FOS_ID" == "null" ]]; then
  FOS_ID=$(echo "$FOS_BODY" | grep -oE '[0-9a-fA-F-]{36}' | head -n1 || true)
fi
log "  → fieldOfStudy UUID = $FOS_ID"

if [[ -z "$FOS_ID" || "$FOS_ID" == "null" ]]; then
  log_both "${RED}❌ لم يتم استخراج fieldOfStudy UUID - توقف قسم 15${NC}"
else
  log_sub "15.1 إكمال الحقول الأساسية للبروفايل (بما فيها fieldOfStudy)"
  request PATCH "/profile" \
    "{
      \"fullName\":\"Jane Doe\",
      \"dateOfBirth\":\"1995-05-15\",
      \"nationality\":\"Jordanian\",
      \"educationLevel\":\"bachelor\",
      \"fieldOfStudy\":[\"$FOS_ID\"],
      \"currentCountry\":\"Jordan\",
      \"currentCity\":\"Amman\",
      \"phone\":\"+962791234567\",
      \"experienceLevel\":\"Mid\",
      \"hasFinancialNeed\":false
    }" \
    "$ACCESS_TOKEN" "200" "إكمال الحقول الأساسية" >/dev/null

  log_sub "15.2 التحقق من اكتمال الحقول الأساسية"
  CORE_CHECK=$(request GET "/profile" "" "$ACCESS_TOKEN" "200" "التحقق من coreFieldsComplete")
  CORE_STATUS=$(echo "$CORE_CHECK" | jq -r '.data.coreFieldsComplete // empty' 2>/dev/null)
  log "  → coreFieldsComplete = $CORE_STATUS"

  if [[ "$CORE_STATUS" == "true" ]]; then
    log "  ✅ الحقول الأساسية مكتملة"
  else
    log "  ❌ الحقول الأساسية لا تزال غير مكتملة"
  fi

  log_sub "15.3 نشر البروفايل لأول مرة"
  request POST "/profile/publish" "" "$ACCESS_TOKEN" "200" "Publish profile" >/dev/null

  log_sub "15.4 التحقق من isDraft بعد النشر"
  PUBLISH_VERIFY=$(request GET "/profile" "" "$ACCESS_TOKEN" "200" "Verify isDraft=false")
  IS_DRAFT=$(echo "$PUBLISH_VERIFY" | jq -r '.data.isDraft // empty' 2>/dev/null)
  log "  → isDraft = $IS_DRAFT"
  if [[ "$IS_DRAFT" == "false" ]]; then
    log "  ✅ البروفايل منشور"
  else
    log "  ❌ isDraft لم يصبح false"
  fi

  log_sub "15.5 نشر مرتين (يجب 409)"
  request POST "/profile/publish" "" "$ACCESS_TOKEN" "409" "Publish twice" >/dev/null || true
fi

# ================================================================
# 16) ADDITIONAL VALIDATION TESTS
# ================================================================
log_section "16) ADDITIONAL VALIDATION TESTS"

log_sub "16.1 Register بكلمة سر ضعيفة جداً"
request POST "/auth/register" \
  '{"email":"weakpass_'$(date +%s)'@levora.com","password":"123","firstName":"Weak","lastName":"Pass"}' \
  "" "400" "Weak password" >/dev/null || true

log_sub "16.2 Register بكلمة سر بدون رقم"
request POST "/auth/register" \
  '{"email":"nonum_'$(date +%s)'@levora.com","password":"OnlyLettersHere","firstName":"No","lastName":"Num"}' \
  "" "400" "Password without number" >/dev/null || true

log_sub "16.3 Email بصيغة غير صحيحة"
request POST "/auth/register" \
  '{"email":"not-an-email","password":"P@ssw0rd123!","firstName":"Bad","lastName":"Email"}' \
  "" "400" "Invalid email format" >/dev/null || true

log_sub "16.4 proficiency = 6 (> 5) بملكية صحيحة"
request POST "/profile/skills" \
  "{\"skillId\":\"$SKILL_ID\",\"proficiency\":6}" \
  "$ACCESS_TOKEN" "400" "proficiency > 5" >/dev/null || true

log_sub "16.5 proficiency = 0 (< 1)"
request POST "/profile/skills" \
  "{\"skillId\":\"$SKILL_ID\",\"proficiency\":0}" \
  "$ACCESS_TOKEN" "400" "proficiency < 1" >/dev/null || true

log_sub "16.6 proficiency = -1"
request POST "/profile/skills" \
  "{\"skillId\":\"$SKILL_ID\",\"proficiency\":-1}" \
  "$ACCESS_TOKEN" "400" "proficiency negative" >/dev/null || true

log_sub "16.7 Update proficiency = 6 (على مهارة موجودة)"
if [[ -n "$SKILL_A_ID" ]]; then
  request PATCH "/profile/skills/$SKILL_A_ID" \
    '{"proficiency":6}' \
    "$ACCESS_TOKEN" "400" "PATCH proficiency > 5" >/dev/null || true
fi

# ================================================================
# 17) PAGINATION BOUNDARIES
# ================================================================
log_section "17) PAGINATION BOUNDARIES"

log_sub "17.1 إنشاء 3 سجلات تعليمية للاختبار"
EDU_1=$(request POST "/profile/educations" \
  '{"degree":"BSc","major":"CS","institution":"Uni1","graduationYear":2020}' \
  "$ACCESS_TOKEN" "201" "edu 1" 2>/dev/null | jq -r '.data.id // empty')
EDU_2=$(request POST "/profile/educations" \
  '{"degree":"MSc","major":"CS","institution":"Uni2","graduationYear":2022}' \
  "$ACCESS_TOKEN" "201" "edu 2" 2>/dev/null | jq -r '.data.id // empty')
EDU_3=$(request POST "/profile/educations" \
  '{"degree":"PhD","major":"CS","institution":"Uni3","graduationYear":2025}' \
  "$ACCESS_TOKEN" "201" "edu 3" 2>/dev/null | jq -r '.data.id // empty')

log "  → Created: $EDU_1 / $EDU_2 / $EDU_3"

log_sub "17.2 page=1&limit=2 (يجب hasNext=true, hasPrev=false)"
PAGE1=$(request GET "/profile/educations?page=1&limit=2" "" "$ACCESS_TOKEN" "200" "page 1 limit 2")
HAS_NEXT_1=$(echo "$PAGE1" | jq -r '.meta.pagination.hasNext' 2>/dev/null)
HAS_PREV_1=$(echo "$PAGE1" | jq -r '.meta.pagination.hasPrev' 2>/dev/null)
log "  → hasNext=$HAS_NEXT_1, hasPrev=$HAS_PREV_1"

log_sub "17.3 page=2&limit=2 (يجب hasNext=false, hasPrev=true)"
PAGE2=$(request GET "/profile/educations?page=2&limit=2" "" "$ACCESS_TOKEN" "200" "page 2 limit 2")
HAS_NEXT_2=$(echo "$PAGE2" | jq -r '.meta.pagination.hasNext' 2>/dev/null)
HAS_PREV_2=$(echo "$PAGE2" | jq -r '.meta.pagination.hasPrev' 2>/dev/null)
log "  → hasNext=$HAS_NEXT_2, hasPrev=$HAS_PREV_2"

log_sub "17.4 page=0 (يجب 400)"
request GET "/profile/educations?page=0" "" "$ACCESS_TOKEN" "400" "page=0" >/dev/null || true

log_sub "17.5 limit=0 (يجب 400)"
request GET "/profile/educations?limit=0" "" "$ACCESS_TOKEN" "400" "limit=0" >/dev/null || true

log_sub "17.6 limit=1000 (يجب 400)"
request GET "/profile/educations?limit=1000" "" "$ACCESS_TOKEN" "400" "limit=1000" >/dev/null || true

log_sub "17.7 تنظيف السجلات"
for id in "$EDU_1" "$EDU_2" "$EDU_3"; do
  [[ -n "$id" && "$id" != "null" ]] && request DELETE "/profile/educations/$id" "" "$ACCESS_TOKEN" "200,204" "cleanup edu" >/dev/null || true
done

# ================================================================
# 18) REAL IDOR - Educations
# ================================================================
log_section "18) REAL IDOR - Educations"

log_sub "18.1 User A ينشئ سجل تعليمي"
EDU_A_BODY=$(request POST "/profile/educations" \
  '{"degree":"BSc","major":"Physics","institution":"A University","graduationYear":2020}' \
  "$ACCESS_TOKEN" "201" "A's education")

EDU_A_ID=$(echo "$EDU_A_BODY" | jq -r '.data.id // empty' 2>/dev/null)
log "  → education A id = $EDU_A_ID"

if [[ -n "$EDU_A_ID" && -n "$ACCESS_TOKEN_B" ]]; then
  log_sub "18.2 IDOR: B يحاول قراءة education of A"
  request GET "/profile/educations/$EDU_A_ID" \
    "" "$ACCESS_TOKEN_B" "403,404,405" "IDOR: B reads A's edu" >/dev/null || true

  log_sub "18.3 IDOR: B يحاول تحديث education of A"
  request PATCH "/profile/educations/$EDU_A_ID" \
    '{"degree":"Hacked"}' \
    "$ACCESS_TOKEN_B" "403,404" "IDOR: B updates A's edu" >/dev/null || true

  log_sub "18.4 IDOR: B يحاول حذف education of A"
  request DELETE "/profile/educations/$EDU_A_ID" \
    "" "$ACCESS_TOKEN_B" "403,404" "IDOR: B deletes A's edu" >/dev/null || true

  log_sub "18.5 التأكد أن السجل لا يزال موجودًا"
  request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "A's educations still there" >/dev/null || true
fi

# ================================================================
# 19) REAL IDOR - Languages
# ================================================================
log_section "19) REAL IDOR - Languages"

log_sub "19.1 User A ينشئ لغة"
LANG_A_BODY=$(request POST "/profile/languages" \
  "{\"languageId\":\"$LANG_ID\",\"proficiency\":\"Basic\"}" \
  "$ACCESS_TOKEN" "201" "A's language")

LANG_A_ID=$(echo "$LANG_A_BODY" | jq -r '.data.languageId // empty' 2>/dev/null)
log "  → language A id = $LANG_A_ID"

if [[ -n "$LANG_A_ID" && -n "$ACCESS_TOKEN_B" ]]; then
  log_sub "19.2 IDOR: B يحاول قراءة language of A"
  request GET "/profile/languages/$LANG_A_ID" \
    "" "$ACCESS_TOKEN_B" "403,404,405" "IDOR: B reads A's lang" >/dev/null || true

  log_sub "19.3 IDOR: B يحاول تحديث language of A"
  request PATCH "/profile/languages/$LANG_A_ID" \
    '{"proficiency":"Native"}' \
    "$ACCESS_TOKEN_B" "403,404" "IDOR: B updates A's lang" >/dev/null || true

  log_sub "19.4 IDOR: B يحاول حذف language of A"
  request DELETE "/profile/languages/$LANG_A_ID" \
    "" "$ACCESS_TOKEN_B" "403,404" "IDOR: B deletes A's lang" >/dev/null || true
fi

# ================================================================
# 20) Cleanup - حذف موارد User A المتبقية
# ================================================================
log_section "20) Cleanup User A resources"

[[ -n "$EDU_A_ID" ]] && request DELETE "/profile/educations/$EDU_A_ID" "" "$ACCESS_TOKEN" "200,204" "cleanup edu A" >/dev/null || true
[[ -n "$LANG_A_ID" ]] && request DELETE "/profile/languages/$LANG_A_ID" "" "$ACCESS_TOKEN" "200,204" "cleanup lang A" >/dev/null || true
[[ -n "$SKILL_A_ID" ]] && request DELETE "/profile/skills/$SKILL_A_ID" "" "$ACCESS_TOKEN" "200,204" "cleanup skill A" >/dev/null || true

# ================================================================
# 21) SECURITY - Rate Limiting
# ================================================================
log_section "21) SECURITY - Rate Limiting (15 attempts)"

RATE_HIT=0
for i in $(seq 1 15); do
  resp=$(request POST "/auth/login" \
    '{"email":"ratelimit@levora.com","password":"x"}' \
    "" "401,429" "Rate limit attempt $i" 2>/dev/null) || true
  code=$(echo "$resp" | jq -r '.status // empty' 2>/dev/null)
  if [[ "$code" == "429" ]]; then
    RATE_HIT=1
    log "  → Rate limit انطلق عند المحاولة #$i ✅"
    break
  fi
done

if [[ "$RATE_HIT" == "1" ]]; then
  log "  ✅ Rate Limiting يعمل"
else
  log "  ⚠️  Rate Limiting لم يُفعّل خلال 15 محاولة"
fi

# ================================================================
# 22) LOGOUT (User A)
# ================================================================
log_section "22) AUTH - Logout (User A)"
request POST "/auth/logout" "" "$ACCESS_TOKEN" "200,204" "تسجيل الخروج" >/dev/null

log_sub "22.b استخدام accessToken بعد Logout"
request GET "/profile" "" "$ACCESS_TOKEN" "401,403" "Token after logout" >/dev/null || true

# ================================================================
# 23) REFRESH TOKEN بعد Logout
# ================================================================
log_section "23) AUTH - Refresh Token after Logout"

log_sub "23.1 محاولة استخدام refreshToken بعد Logout"
request POST "/auth/refresh" \
  "{\"refreshToken\":\"$REFRESH_TOKEN\"}" \
  "" "401,403" "Refresh after logout" >/dev/null || true

# ================================================================
# SUMMARY
# ================================================================
TOTAL=$(counter_get TOTAL)
PASSED=$(counter_get PASSED)
FAILED=$(counter_get FAILED)

log ""
log "═══════════════════════════════════════════════════════════════"
log "  SUMMARY"
log "═══════════════════════════════════════════════════════════════"
log "  Total  : $TOTAL"
log "  Passed : $PASSED"
log "  Failed : $FAILED"
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
