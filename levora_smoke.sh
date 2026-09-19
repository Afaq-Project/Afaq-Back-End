#!/usr/bin/env bash
set -uo pipefail

# ================================================================
# Levora API - Full Test Suite with File Logging
# Ubuntu / Bash / curl / jq
# ================================================================

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
LOG_FILE="${LOG_FILE:-levora_test_log_$(date +%Y%m%d_%H%M%S).txt}"

# ملفات العدّادات المؤقتة (لحل مشكلة subshell)
COUNTER_DIR="$(mktemp -d)"
trap 'rm -rf "$COUNTER_DIR"' EXIT

# بيانات المستخدم الأساسي
EMAIL="levora_test_$(date +%s)@example.com"
PASSWORD='P@ssw0rd123!'
FIRST_NAME="John"
LAST_NAME="Doe"

# بيانات مستخدم ثانٍ لاختبار IDOR الحقيقي
EMAIL_B="levora_test_b_$(date +%s)@example.com"
PASSWORD_B='P@ssw0rd456!'

# ألوان
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

# ================================================================
# عدّادات عبر ملفات (subshell-safe)
# ================================================================
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

# ================================================================
# تسجيل في الملف
# ================================================================
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
# دالة تنفيذ الطلبات
#   - stdout : جسم الاستجابة فقط
#   - stderr : رسائل بشرية
#   - log    : كل التفاصيل
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

  # تسجيل الطلب
  log "▶ REQUEST #$n"
  log "  Method     : $method"
  log "  URL        : $url"
  [[ -n "$description" ]] && log "  Description: $description"
  [[ -n "$token" ]] && log "  Auth       : Bearer ${token:0:30}..."
  [[ -n "$data" ]] && log "  Body       : $data"
  log "  Expected   : HTTP $expected"
  log ""

  # التنفيذ
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

  # تسجيل الاستجابة
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

  # التحقق
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

# ================================================================
# البداية
# ================================================================
init_log

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════"
echo "  Levora API - Full Test Suite"
echo "  Log: $LOG_FILE"
echo "═══════════════════════════════════════════════════"
echo -e "${NC}"

# ================================================================
# 1) AUTH - Register user A
# ================================================================
log_section "1) AUTH - Register (User A)"
REGISTER_BODY=$(request POST "/auth/register" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"$FIRST_NAME\",\"lastName\":\"$LAST_NAME\"}" \
  "" "201" "تسجيل المستخدم A")

USER_ID=$(echo "$REGISTER_BODY" | jq -r '.data.id // empty' 2>/dev/null)
log "  → userId A = $USER_ID"

# ================================================================
# 2) AUTH - Login user A
# ================================================================
log_section "2) AUTH - Login (User A)"
LOGIN_BODY=$(request POST "/auth/login" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  "" "200" "تسجيل دخول A")

ACCESS_TOKEN=$(echo "$LOGIN_BODY" | jq -r '.data.accessToken // .data.tokens.accessToken // empty' 2>/dev/null)
REFRESH_TOKEN=$(echo "$LOGIN_BODY" | jq -r '.data.refreshToken // .data.tokens.refreshToken // empty' 2>/dev/null)

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

EDU_ID=$(echo "$EDU_CREATE_BODY" | jq -r '.data.id // .data.education.id // empty' 2>/dev/null)
log "  → educationId = $EDU_ID"

request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "قائمة التعليمات بعد الإضافة" >/dev/null

if [[ -n "$EDU_ID" ]]; then
  request PATCH "/profile/educations/$EDU_ID" \
    '{"gpaValue":3.8,"gpaScale":"4.0"}' \
    "$ACCESS_TOKEN" "200" "تحديث السجل التعليمي" >/dev/null

  request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "التحقق من التحديث" >/dev/null

  request DELETE "/profile/educations/$EDU_ID" "" "$ACCESS_TOKEN" "200,204" "حذف السجل التعليمي" >/dev/null

  request GET "/profile/educations" "" "$ACCESS_TOKEN" "200" "التحقق من الحذف" >/dev/null

  # حذف مرة ثانية -> 404
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

NEW_ACCESS=$(echo "$REFRESH_BODY" | jq -r '.data.accessToken // .data.tokens.accessToken // empty' 2>/dev/null)
NEW_REFRESH=$(echo "$REFRESH_BODY" | jq -r '.data.refreshToken // .data.tokens.refreshToken // empty' 2>/dev/null)

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
# 14) SECURITY - Real IDOR (User B tries to access User A's resource)
# ================================================================
log_section "14) SECURITY - Real IDOR Test"

# 14.1 Register user B
log_sub "14.1 Register User B"
REGISTER_B=$(request POST "/auth/register" \
  "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD_B\",\"firstName\":\"Bob\",\"lastName\":\"Smith\"}" \
  "" "201" "تسجيل المستخدم B")

USER_B_ID=$(echo "$REGISTER_B" | jq -r '.data.id // empty' 2>/dev/null)
log "  → userId B = $USER_B_ID"

# 14.2 Login user B
log_sub "14.2 Login User B"
LOGIN_B=$(request POST "/auth/login" \
  "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD_B\"}" \
  "" "200" "تسجيل دخول B")

ACCESS_TOKEN_B=$(echo "$LOGIN_B" | jq -r '.data.accessToken // empty' 2>/dev/null)
log "  → accessToken B = ${ACCESS_TOKEN_B:0:40}..."

# 14.3 User A ينشئ skill
log_sub "14.3 User A ينشئ skill"
SKILL_A_BODY=$(request POST "/profile/skills" \
  "{\"skillId\":\"$SKILL_ID\",\"proficiency\":3}" \
  "$ACCESS_TOKEN" "201" "User A skill")

SKILL_A_ID=$(echo "$SKILL_A_BODY" | jq -r '.data.skillId // .data.id // empty' 2>/dev/null)
log "  → skill A id = $SKILL_A_ID"

# 14.4 User B يحاول الوصول لمهارة User A
if [[ -n "$SKILL_A_ID" && -n "$ACCESS_TOKEN_B" ]]; then
  log_sub "14.4 IDOR: User B يحاول قراءة مهارة User A"
  request GET "/profile/skills/$SKILL_A_ID" \
    "" "$ACCESS_TOKEN_B" "403,404" "IDOR: B reads A's skill" >/dev/null || true

  log_sub "14.5 IDOR: User B يحاول تحديث مهارة User A"
  request PATCH "/profile/skills/$SKILL_A_ID" \
    '{"proficiency":99}' \
    "$ACCESS_TOKEN_B" "403,404" "IDOR: B updates A's skill" >/dev/null || true

  log_sub "14.6 IDOR: User B يحاول حذف مهارة User A"
  request DELETE "/profile/skills/$SKILL_A_ID" \
    "" "$ACCESS_TOKEN_B" "403,404" "IDOR: B deletes A's skill" >/dev/null || true

  # تنظيف
  log_sub "14.7 User A يحذف مهارته (تنظيف)"
  request DELETE "/profile/skills/$SKILL_A_ID" \
    "" "$ACCESS_TOKEN" "200,204" "cleanup A's skill" >/dev/null || true
fi

# ================================================================
# 15) SECURITY - Rate Limiting
# ================================================================
log_section "15) SECURITY - Rate Limiting (15 attempts)"

RATE_HIT=0
for i in $(seq 1 15); do
  resp=$(request POST "/auth/login" \
    '{"email":"ratelimit@levora.com","password":"x"}' \
    "" "401,429" "Rate limit attempt $i" 2>/dev/null) || true
  # نستخرج الكود
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
# 16) LOGOUT
# ================================================================
log_section "16) AUTH - Logout (User A)"
request POST "/auth/logout" "" "$ACCESS_TOKEN" "200,204" "تسجيل الخروج" >/dev/null

# 16.b: استخدام توكن بعد logout
log_sub "16.b استخدام accessToken بعد Logout"
request GET "/profile" "" "$ACCESS_TOKEN" "401,403" "Token after logout" >/dev/null || true

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
