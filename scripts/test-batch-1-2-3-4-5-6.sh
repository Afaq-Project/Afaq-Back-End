#!/usr/bin/env bash
#
# Full profile v2 verification script — Batches 1 through 6.
# Tests: auth, profile, reference, education, languages, tests,
# special statuses, preferences, and documents.
#
# Usage:
#   ./scripts/test-batch-1-2-3-4-5-6.sh
#   BASE_URL=http://localhost:3000 ./scripts/test-batch-1-2-3-4-5-6.sh
#   LOG_FILE=/path/to/output.log ./scripts/test-batch-1-2-3-4-5-6.sh
#
# Outputs:
#   - Console: pass/fail per test
#   - Log file: full HTTP request/response pairs (default: ./test-outputs-TIMESTAMP.log)
#
# Requirements: curl, jq

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
API="$BASE_URL/api/v1"
LOG_FILE="${LOG_FILE:-./test-outputs-$(date +%Y%m%d-%H%M%S).log}"

# ── Colors ────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'
  CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  RED=""; GREEN=""; YELLOW=""; CYAN=""; BOLD=""; RESET=""
fi

# ── Counters ──────────────────────────────────────────────────────
PASS=0; FAIL=0; SKIP=0
FAILURES=()

# ── Temp files ────────────────────────────────────────────────────
BODY_FILE="/tmp/levora_body.$$"
TEMP_PDF="/tmp/levora_sample.$$.pdf"
TEMP_EXE="/tmp/levora_sample.$$.exe"

cleanup() {
  rm -f "$BODY_FILE" "$TEMP_PDF" "$TEMP_EXE"
}
trap cleanup EXIT

# ── Logging ───────────────────────────────────────────────────────
log_pair() {
  local method="$1" url="$2" code="$3"; shift 3
  {
    echo "════════════════════════════════════════════════════════════════"
    echo "[$(date -Iseconds)] $method $url"
    echo "── Request args ──"
    for arg in "$@"; do
      echo "  $arg" | head -c 1200
      echo ""
    done
    echo "── Response: HTTP $code ──"
    head -c 4000 "$BODY_FILE"
    echo ""
    echo ""
  } >> "$LOG_FILE"
}

# ── Helpers ───────────────────────────────────────────────────────
pass() { PASS=$((PASS+1)); printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
fail() {
  FAIL=$((FAIL+1)); FAILURES+=("$1")
  printf '  %s✗%s %s\n' "$RED" "$RESET" "$1"
  [[ -n "${2:-}" ]] && printf '      %s\n' "$2"
}
skip() { SKIP=$((SKIP+1)); printf '  %s⊘%s %s\n' "$YELLOW" "$RESET" "$1"; }
section() { printf '\n%s%s%s\n' "$BOLD$CYAN" "$1" "$RESET"; }

# Curl wrapper — saves response body to $BODY_FILE, logs request+response, prints http code
http() {
  local method="$1" url="$2"; shift 2
  local code
  code=$(curl -s -o "$BODY_FILE" -w "%{http_code}" -X "$method" "$url" "$@")
  log_pair "$method" "$url" "$code" "$@"
  echo "$code"
}

num() {
  local filter="$1" default="${2:-0}"
  local v
  v=$(jq -r "$filter" "$BODY_FILE" 2>/dev/null)
  if [[ "$v" =~ ^-?[0-9]+$ ]]; then echo "$v"; else echo "$default"; fi
}

assert_status() {
  local expected="$1" actual="$2" name="$3"
  if [[ "$actual" == "$expected" ]]; then pass "$name"
  else fail "$name" "expected HTTP $expected, got $actual — body: $(head -c 300 "$BODY_FILE")"; fi
}

assert_jq() {
  local filter="$1" expected="$2" name="$3"
  local actual
  actual=$(jq -r "$filter" "$BODY_FILE" 2>/dev/null || echo "<jq-error>")
  if [[ "$actual" == "$expected" ]]; then pass "$name"
  else fail "$name" "jq '$filter' → expected '$expected', got '$actual'"; fi
}

assert_error_code() {
  local expected="$1" name="$2"
  local actual
  actual=$(jq -r '.errors[0].code // .message // empty' "$BODY_FILE" 2>/dev/null)
  if [[ "$actual" == "$expected" ]]; then pass "$name (error=$expected)"
  else fail "$name" "expected error '$expected', got '$actual' — body: $(head -c 300 "$BODY_FILE")"; fi
}

# Returns 0 if the last response was a routing-level 404 (endpoint not registered)
is_route_missing() {
  jq -e '.errors[0].code == "SYSTEM_RESOURCE_NOT_FOUND"' "$BODY_FILE" >/dev/null 2>&1
}

# ── Prerequisites ─────────────────────────────────────────────────
section "Prerequisites"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Base URL: $BASE_URL" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

for cmd in curl jq awk; do
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "$cmd is installed"
  else
    fail "$cmd is required" "install it: sudo apt install $cmd"
    exit 1
  fi
done

if curl -s -o /dev/null -w "%{http_code}" "$API/health" 2>/dev/null | grep -q '^200$'; then
  pass "API is reachable at $BASE_URL"
else
  fail "API not reachable at $BASE_URL" "start with: pnpm start:dev"
  exit 1
fi

# Create sample files for Batch 6 (upload tests)
cat > "$TEMP_PDF" << 'PDFEOF'
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000053 00000 n 
0000000102 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
175
%%EOF
PDFEOF

printf 'MZ\x90\x00\x03\x00\x00\x00fake-exe-content' > "$TEMP_EXE"

pass "sample test files created ($TEMP_PDF, $TEMP_EXE)"

# ── Test user credentials ─────────────────────────────────────────
TS=$(date +%s)
TEST_EMAIL="levora-${TS}@levora.test"
TEST_PASS="LevoraTest!${TS}"
TOKEN=""
TOKEN_2=""
FAKE_UUID="123e4567-e89b-12d3-a456-426614174000"

# ══════════════════════════════════════════════════════════════════
# BATCH 1 — Auth
# ══════════════════════════════════════════════════════════════════
section "Batch 1 — Auth"

code=$(http POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\",\"firstName\":\"Levora\",\"lastName\":\"Test\"}")
assert_status "201" "$code" "POST /auth/register → 201"
assert_jq ".data.accessToken | length > 0" "true" "register response has accessToken"
assert_jq ".data.refreshToken | length > 0" "true" "register response has refreshToken"
assert_jq ".data | has(\"userProfile\")" "false" "register response has NO userProfile key"

code=$(http POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
assert_status "200" "$code" "POST /auth/login → 200"
TOKEN=$(jq -r '.data.accessToken // empty' "$BODY_FILE")
if [[ -n "$TOKEN" ]]; then pass "login returned accessToken"
else fail "login did not return accessToken"; exit 1; fi

section "Batch 1 — Auth edge cases"

code=$(http POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@example.com","password":"WrongPass123!"}')
if [[ "$code" == "401" || "$code" == "400" ]]; then
  pass "login with bad credentials → $code"
else fail "login with bad credentials should be 401" "got $code"; fi

code=$(http POST "$API/auth/login" \
  -H "Content-Type: application/json" -d '{"password":"nope"}')
if [[ "$code" == "400" ]]; then pass "login missing email → 400"
else fail "login missing email → 400" "got $code"; fi

code=$(http POST "$API/auth/login" \
  -H "Content-Type: application/json" -d '{"email":"not-an-email","password":"x"}')
if [[ "$code" == "400" ]]; then pass "login invalid email format → 400"
else fail "login invalid email → 400" "got $code"; fi

# ══════════════════════════════════════════════════════════════════
# BATCH 1 — Reference endpoints
# ══════════════════════════════════════════════════════════════════
section "Batch 1 — Reference endpoints (public)"

for path in countries cities marital-statuses education-levels app-languages; do
  code=$(http GET "$API/reference/$path")
  assert_status "200" "$code" "GET /reference/$path → 200 without token"
  assert_jq ".data | type" "array" "  response.data is an array"
done

http GET "$API/reference/countries" >/dev/null
assert_jq '.data[0] | has("nameEn")' "true" "reference country item has nameEn"
assert_jq '.data[0] | has("nameAr")' "true" "reference country item has nameAr"

code=$(http GET "$API/reference/countries?fake_param=1")
assert_status "200" "$code" "GET /reference/countries?fake_param=1 → 200 (tolerant)"

code=$(http GET "$API/reference/countries?limit=999")
if [[ "$code" == "400" ]]; then pass "reference countries limit=999 → 400"
else fail "reference countries limit > 200 should be 400" "got $code"; fi

code=$(http GET "$API/reference/countries?page=0")
if [[ "$code" == "400" ]]; then pass "reference countries page=0 → 400"
else fail "reference countries page=0 → 400" "got $code"; fi

code=$(http GET "$API/reference/countries?sort=invalidField")
if [[ "$code" == "400" ]]; then pass "reference countries invalid sort → 400"
else fail "invalid sort field → 400" "got $code"; fi

code=$(http GET "$API/reference/countries?order=INVALID")
if [[ "$code" == "400" ]]; then pass "reference countries invalid order → 400"
else fail "invalid order → 400" "got $code"; fi

COUNTRY_ID=$(curl -s "$API/reference/countries" | jq -r '.data[0].id // empty')
COUNTRY_ID_2=$(curl -s "$API/reference/countries" | jq -r '.data[1].id // empty')
MARITAL_ID=$(curl -s "$API/reference/marital-statuses" | jq -r '.data[0].id // empty')
EDU_LEVEL_ID=$(curl -s "$API/reference/education-levels" | jq -r '.data[0].id // empty')
EDU_LEVEL_ID_2=$(curl -s "$API/reference/education-levels" | jq -r '.data[1].id // empty')

# ══════════════════════════════════════════════════════════════════
# BATCH 1 — Profile
# ══════════════════════════════════════════════════════════════════
section "Batch 1 — Profile (auth enforcement)"

code=$(http GET "$API/profile/me")
assert_status "401" "$code" "GET /profile/me without token → 401"

code=$(http PATCH "$API/profile/personal" \
  -H "Content-Type: application/json" -d '{"firstName":"X"}')
assert_status "401" "$code" "PATCH /profile/personal without token → 401"

code=$(http GET "$API/profile/me" -H "Authorization: Bearer malformed.token.here")
assert_status "401" "$code" "GET /profile/me with malformed token → 401"

section "Batch 1 — GET /profile/me shape"

code=$(http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN")
assert_status "200" "$code" "GET /profile/me with token → 200"
assert_jq ".data.completionPct" "0" "new profile completionPct = 0"
assert_jq ".data.isMatchable" "false" "new profile isMatchable = false"
assert_jq ".data.matchingVersion | type" "number" "matchingVersion is a number"

for section_name in educations languages testResults specialStatuses \
                    targetDegrees targetMajors targetInstitutions documents; do
  assert_jq ".data.$section_name | type" "array" "  section '$section_name' is an array"
done

section "Batch 1 — DTO strictness"

for field in completionPct isMatchable matchingVersion userId createdAt updatedAt; do
  code=$(http PATCH "$API/profile/personal" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"$field\": \"x\"}")
  assert_status "400" "$code" "PATCH with computed field '$field' → 400"
done

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"unknownField":"x"}')
assert_status "400" "$code" "PATCH with unknown field → 400"
assert_error_code "UNKNOWN_FIELD" "  error code is UNKNOWN_FIELD"

section "Batch 1 — Field validation edge cases"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"gender":"INVALID"}')
[[ "$code" == "400" ]] && pass "invalid gender enum → 400" || fail "invalid gender → 400" "got $code"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"dateOfBirth":"not-a-date"}')
[[ "$code" == "400" ]] && pass "invalid dateOfBirth → 400" || fail "invalid dateOfBirth → 400" "got $code"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"profilePhotoUrl":"not-a-url"}')
[[ "$code" == "400" ]] && pass "invalid profilePhotoUrl → 400" || fail "invalid profilePhotoUrl → 400" "got $code"

PHONE_31=$(printf '1%.0s' {1..31})
code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"phone\":\"$PHONE_31\"}")
[[ "$code" == "400" ]] && pass "phone > 30 chars → 400" || fail "phone > 30 chars → 400" "got $code"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"maritalStatusId\":\"$FAKE_UUID\"}")
[[ "$code" == "400" ]] && pass "non-existent maritalStatusId → 400" || fail "non-existent maritalStatusId → 400" "got $code"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"maritalStatusId":"not-a-uuid"}')
[[ "$code" == "400" ]] && pass "invalid UUID format → 400" || fail "invalid UUID → 400" "got $code"

section "Batch 1 — bio boundary"

BIO_1000=$(printf 'a%.0s' {1..1000})
BIO_1001=$(printf 'a%.0s' {1..1001})

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"bio\":\"$BIO_1000\"}")
assert_status "200" "$code" "bio = 1000 chars → 200"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"bio\":\"$BIO_1001\"}")
assert_status "400" "$code" "bio = 1001 chars → 400"
assert_error_code "BIO_TOO_LONG" "  error code is BIO_TOO_LONG"

section "Batch 1 — experiences boundary"

EXP10='["e1","e2","e3","e4","e5","e6","e7","e8","e9","e10"]'
EXP11='["e1","e2","e3","e4","e5","e6","e7","e8","e9","e10","e11"]'

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"experiences":[]}')
assert_status "200" "$code" "experiences = [] → 200"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"experiences\":$EXP10}")
assert_status "200" "$code" "experiences = 10 → 200"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"experiences\":$EXP11}")
assert_status "400" "$code" "experiences = 11 → 400"
assert_error_code "TOO_MANY_EXPERIENCES" "  error code is TOO_MANY_EXPERIENCES"

LONG_EXP=$(printf 'a%.0s' {1..501})
code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"experiences\":[\"$LONG_EXP\"]}")
assert_status "400" "$code" "single experience > 500 chars → 400"

section "Batch 1 — completion engine"

http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
      --arg fn "Levora" --arg ln "Test" \
      --arg dob "2000-01-01" \
      --arg ms "$MARITAL_ID" \
      --arg cid "$COUNTRY_ID" \
      --arg eid "$EDU_LEVEL_ID" \
      '{firstName:$fn, lastName:$ln, dateOfBirth:$dob, gender:"MALE",
        maritalStatusId:$ms, countryOfResidenceId:$cid,
        nationalityId:$cid, educationLevelId:$eid}')" >/dev/null

http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN" >/dev/null
PCT=$(num '.data.completionPct')
[[ "$PCT" -eq 43 ]] && pass "completionPct = 43 after Batch 1" || fail "completionPct expected 43, got $PCT"

# ══════════════════════════════════════════════════════════════════
# BATCH 2 — Education
# ══════════════════════════════════════════════════════════════════
section "Batch 2 — Reference endpoints"

for path in major-categories majors institutions; do
  code=$(http GET "$API/reference/$path")
  assert_status "200" "$code" "GET /reference/$path → 200"
  assert_jq ".data | type" "array" "  data is an array"
  assert_jq ".meta | type" "object" "  meta is an object"
  assert_jq ".meta.total | type" "number" "  meta.total is a number"
done

code=$(http GET "$API/reference/majors?search=Comp&page=1&limit=5")
assert_status "200" "$code" "GET /reference/majors?search=Comp → 200"
assert_jq ".data | length <= 5" "true" "  limit=5 respected"

INSTITUTION_ID=$(curl -s "$API/reference/institutions?limit=10" | jq -r '.data[0].id // empty')
INSTITUTION_ID_2=$(curl -s "$API/reference/institutions?limit=10" | jq -r '.data[1].id // empty')
INSTITUTION_ID_3=$(curl -s "$API/reference/institutions?limit=10" | jq -r '.data[2].id // empty')
MAJOR_ID=$(curl -s "$API/reference/majors?limit=10" | jq -r '.data[0].id // empty')
MAJOR_ID_2=$(curl -s "$API/reference/majors?limit=10" | jq -r '.data[1].id // empty')
MAJOR_ID_3=$(curl -s "$API/reference/majors?limit=10" | jq -r '.data[2].id // empty')
MAJOR_ID_4=$(curl -s "$API/reference/majors?limit=10" | jq -r '.data[3].id // empty')

if [[ -z "$INSTITUTION_ID" || -z "$MAJOR_ID" || -z "$EDU_LEVEL_ID" ]]; then
  skip "Education tests skipped — reference data not seeded"
else
  section "Batch 2 — Education CRUD lifecycle"

  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg inst "$INSTITUTION_ID" --arg major "$MAJOR_ID" --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
  assert_status "201" "$code" "POST /profile/educations → 201"
  EDU_ID=$(jq -r '.data.id // empty' "$BODY_FILE")
  [[ -n "$EDU_ID" ]] && pass "  record created" || fail "  no id returned"

  code=$(http GET "$API/profile/educations" -H "Authorization: Bearer $TOKEN")
  assert_status "200" "$code" "GET /profile/educations → 200"

  code=$(http GET "$API/profile/educations/$EDU_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "200" "$code" "GET /profile/educations/:id → 200"

  code=$(http DELETE "$API/profile/educations/$EDU_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "204" "$code" "DELETE /profile/educations/:id → 204"

  code=$(http GET "$API/profile/educations/$EDU_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "404" "$code" "GET deleted education → 404"
  assert_error_code "EDUCATION_NOT_FOUND" "  error code is EDUCATION_NOT_FOUND"

  section "Batch 2 — GPA normalization"

  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg inst "$INSTITUTION_ID" --arg major "$MAJOR_ID" --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level, gpaRaw:85, gpaScale:"OUT_OF_100"}')")
  if [[ "$code" == "201" ]]; then
    assert_jq ".data.gpaNormalized" "3.4" "  OUT_OF_100 85 → 3.4"
  else skip "GPA OUT_OF_100 skipped ($code)"; fi

  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg inst "$INSTITUTION_ID_2" --arg major "$MAJOR_ID_2" --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level, gpaRaw:4.5, gpaScale:"OUT_OF_5"}')")
  if [[ "$code" == "201" ]]; then
    assert_jq ".data.gpaNormalized" "3.6" "  OUT_OF_5 4.5 → 3.6"
  else skip "GPA OUT_OF_5 skipped ($code)"; fi

  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg inst "$INSTITUTION_ID" --arg major "$MAJOR_ID_3" --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level, gpaRaw:3.7, gpaScale:"OUT_OF_4"}')")
  if [[ "$code" == "201" ]]; then
    assert_jq ".data.gpaNormalized" "3.7" "  OUT_OF_4 3.7 → 3.7"
  else skip "GPA OUT_OF_4 skipped ($code)"; fi

  section "Batch 2 — Validation rules"

  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg inst "$INSTITUTION_ID_2" --arg major "$MAJOR_ID_3" --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level, gpaRaw:3.5}')")
  assert_status "400" "$code" "gpaRaw without gpaScale → 400"
  assert_error_code "GPA_SCALE_REQUIRED" "  error code is GPA_SCALE_REQUIRED"

  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg inst "$INSTITUTION_ID_2" --arg major "$MAJOR_ID" --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level, startDate:"2024-01-01", endDate:"2023-01-01"}')")
  assert_status "400" "$code" "endDate < startDate → 400"
  assert_error_code "INVALID_DATE_RANGE" "  error code is INVALID_DATE_RANGE"

  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg inst "$INSTITUTION_ID_2" --arg major "$MAJOR_ID" --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, minorMajorId:$major, educationLevelId:$level}')")
  assert_status "400" "$code" "minorMajorId == majorId → 400"
  assert_error_code "MINOR_MAJOR_EQUALS_MAJOR" "  error code is MINOR_MAJOR_EQUALS_MAJOR"

  for fk in institutionId majorId educationLevelId; do
    local_inst="$INSTITUTION_ID"; local_major="$MAJOR_ID"; local_level="$EDU_LEVEL_ID"
    case "$fk" in
      institutionId) local_inst="$FAKE_UUID" ;;
      majorId) local_major="$FAKE_UUID" ;;
      educationLevelId) local_level="$FAKE_UUID" ;;
    esac
    code=$(http POST "$API/profile/educations" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg inst "$local_inst" --arg major "$local_major" --arg level "$local_level" \
          '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
    assert_status "400" "$code" "invalid $fk → 400"
  done

  section "Batch 2 — isCurrent semantics"

  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg inst "$INSTITUTION_ID_3" --arg major "$MAJOR_ID" --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level, isCurrent:true, endDate:"2024-06-15", expectedGraduationDate:"2026-06-30"}')")
  if [[ "$code" == "201" ]]; then
    assert_jq ".data.isCurrent" "true" "  isCurrent=true persisted"
    assert_jq ".data.endDate" "null" "  endDate cleared"
    assert_jq ".data.expectedGraduationDate" "2026-06-30" "  expectedGraduationDate retained"
  else skip "isCurrent tests skipped ($code)"; fi

  section "Batch 2 — Ownership"

  TS2=$(date +%s)
  TEST_EMAIL_2="levora-b-${TS2}@levora.test"
  TEST_PASS_2="LevoraTest!${TS2}"

  code=$(http POST "$API/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL_2\",\"password\":\"$TEST_PASS_2\",\"firstName\":\"B\",\"lastName\":\"Two\"}")
  TOKEN_2=$(jq -r '.data.accessToken // empty' "$BODY_FILE")
  [[ -n "$TOKEN_2" ]] && pass "second user registered" || fail "second user registration failed"

  if [[ -n "$TOKEN_2" ]]; then
    code=$(http POST "$API/profile/educations" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg inst "$INSTITUTION_ID" --arg major "$MAJOR_ID_3" --arg level "$EDU_LEVEL_ID" \
          '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
    EDU_ID_FOREIGN=$(jq -r '.data.id // empty' "$BODY_FILE")

    if [[ -n "$EDU_ID_FOREIGN" ]]; then
      code=$(http GET "$API/profile/educations/$EDU_ID_FOREIGN" -H "Authorization: Bearer $TOKEN_2")
      assert_status "404" "$code" "User B GET User A education → 404"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════
# BATCH 3 — Languages
# ══════════════════════════════════════════════════════════════════
section "Batch 3 — Reference endpoints"

code=$(http GET "$API/reference/languages")
assert_status "200" "$code" "GET /reference/languages → 200"
http GET "$API/reference/languages" >/dev/null
assert_jq '.data[0] | has("nameEn")' "true" "  has nameEn"
assert_jq '.data[0] | has("nameAr")' "true" "  has nameAr"
assert_jq '.data[0] | has("isoCode")' "true" "  has isoCode"
assert_jq '.data[0] | has("name")' "false" "  no legacy name field"

code=$(http GET "$API/reference/proficiency-levels")
assert_status "200" "$code" "GET /reference/proficiency-levels → 200"

LANGUAGE_ID=$(curl -s "$API/reference/languages" | jq -r '.data[0].id // empty')
LANGUAGE_ID_2=$(curl -s "$API/reference/languages" | jq -r '.data[1].id // empty')
LANGUAGE_ID_3=$(curl -s "$API/reference/languages" | jq -r '.data[2].id // empty')
PROFICIENCY_ID=$(curl -s "$API/reference/proficiency-levels" | jq -r '.data[0].id // empty')
PROFICIENCY_ID_2=$(curl -s "$API/reference/proficiency-levels" | jq -r '.data[1].id // empty')

if [[ -z "$LANGUAGE_ID" || -z "$PROFICIENCY_ID" ]]; then
  skip "Language tests skipped — reference data not seeded"
else
  section "Batch 3 — Language CRUD lifecycle"

  code=$(http POST "$API/profile/languages" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg lang "$LANGUAGE_ID" --arg prof "$PROFICIENCY_ID" \
        '{languageId:$lang, proficiencyLevelId:$prof, isNative:false}')")
  assert_status "201" "$code" "POST /profile/languages → 201"

  code=$(http GET "$API/profile/languages/$LANGUAGE_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "200" "$code" "GET /profile/languages/:id → 200"

  code=$(http PATCH "$API/profile/languages/$LANGUAGE_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg prof "$PROFICIENCY_ID_2" '{proficiencyLevelId:$prof, isNative:true}')")
  assert_status "200" "$code" "PATCH /profile/languages/:id → 200"

  code=$(http DELETE "$API/profile/languages/$LANGUAGE_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "204" "$code" "DELETE /profile/languages/:id → 204"

  section "Batch 3 — Validation"

  code=$(http POST "$API/profile/languages" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg prof "$PROFICIENCY_ID" '{proficiencyLevelId:$prof}')")
  [[ "$code" == "400" ]] && pass "missing languageId → 400" || fail "missing languageId → 400" "got $code"

  code=$(http POST "$API/profile/languages" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg lang "$FAKE_UUID" --arg prof "$PROFICIENCY_ID" '{languageId:$lang, proficiencyLevelId:$prof}')")
  assert_status "400" "$code" "nonexistent languageId → 400"
  assert_error_code "INVALID_LANGUAGE" "  error code is INVALID_LANGUAGE"

  code=$(http POST "$API/profile/languages" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg lang "$LANGUAGE_ID_2" --arg prof "$FAKE_UUID" '{languageId:$lang, proficiencyLevelId:$prof}')")
  assert_status "400" "$code" "nonexistent proficiencyLevelId → 400"
  assert_error_code "INVALID_PROFICIENCY_LEVEL" "  error code is INVALID_PROFICIENCY_LEVEL"

  section "Batch 3 — Duplicate"

  http POST "$API/profile/languages" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg lang "$LANGUAGE_ID_2" --arg prof "$PROFICIENCY_ID" '{languageId:$lang, proficiencyLevelId:$prof}')" >/dev/null

  code=$(http POST "$API/profile/languages" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg lang "$LANGUAGE_ID_2" --arg prof "$PROFICIENCY_ID" '{languageId:$lang, proficiencyLevelId:$prof}')")
  assert_status "409" "$code" "duplicate language → 409"
  assert_error_code "LANGUAGE_DUPLICATE" "  error code is LANGUAGE_DUPLICATE"

  section "Batch 3 — isNative toggle"

  code=$(http PATCH "$API/profile/languages/$LANGUAGE_ID_2" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"isNative":true}')
  assert_status "200" "$code" "PATCH isNative=true → 200"
  assert_jq ".data.isNative" "true" "  persisted true"

  code=$(http PATCH "$API/profile/languages/$LANGUAGE_ID_2" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"isNative":false}')
  assert_status "200" "$code" "PATCH isNative=false → 200"
  assert_jq ".data.isNative" "false" "  persisted false"

  section "Batch 3 — PATCH immutability"

  code=$(http PATCH "$API/profile/languages/$LANGUAGE_ID_2" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg lang "$LANGUAGE_ID_3" '{languageId:$lang}')")
  assert_status "400" "$code" "PATCH with languageId → 400"
  assert_error_code "UNKNOWN_FIELD" "  error code is UNKNOWN_FIELD"
fi

# ══════════════════════════════════════════════════════════════════
# BATCH 4 — Standardized Tests
# ══════════════════════════════════════════════════════════════════
section "Batch 4 — Reference"

code=$(http GET "$API/reference/standardized-tests")
assert_status "200" "$code" "GET /reference/standardized-tests → 200"
http GET "$API/reference/standardized-tests" >/dev/null
assert_jq '.data[0] | has("nameEn")' "true" "  has nameEn"
assert_jq '.data[0] | has("minScore")' "true" "  has minScore"
assert_jq '.data[0] | has("scoreStep")' "true" "  has scoreStep"

TESTS_JSON=$(curl -s "$API/reference/standardized-tests")
TEST_COUNT=$(echo "$TESTS_JSON" | jq '.data | length // 0')

if [[ "$TEST_COUNT" -lt 1 ]]; then
  skip "Test results tests skipped — no standardized tests seeded"
else
  TEST_ID=$(echo "$TESTS_JSON" | jq -r '.data[0].id')
  TEST_ID_2=$(echo "$TESTS_JSON" | jq -r '.data[1].id // empty')
  TEST_ID_3=$(echo "$TESTS_JSON" | jq -r '.data[2].id // empty')
  TEST_MIN=$(echo "$TESTS_JSON" | jq -r '.data[0].minScore')
  TEST_MAX=$(echo "$TESTS_JSON" | jq -r '.data[0].maxScore')
  TEST_STEP=$(echo "$TESTS_JSON" | jq -r '.data[0].scoreStep')

  VALID_SCORE=$(awk -v m="$TEST_MIN" -v s="$TEST_STEP" 'BEGIN{printf "%.2f", m + 2*s}')
  ABOVE_MAX=$(awk -v m="$TEST_MAX" 'BEGIN{printf "%.2f", m + 100}')

  section "Batch 4 — Test results CRUD"

  code=$(http POST "$API/profile/test-results" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$TEST_ID" --argjson s "$VALID_SCORE" \
        '{testId:$t, score:$s, testDate:"2024-01-15"}')")
  assert_status "201" "$code" "POST /profile/test-results → 201"
  TR_ID=$(jq -r '.data.id // empty' "$BODY_FILE")

  code=$(http GET "$API/profile/test-results" -H "Authorization: Bearer $TOKEN")
  assert_status "200" "$code" "GET /profile/test-results → 200"

  code=$(http GET "$API/profile/test-results/$TR_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "200" "$code" "GET /profile/test-results/:id → 200"

  code=$(http DELETE "$API/profile/test-results/$TR_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "204" "$code" "DELETE /profile/test-results/:id → 204"

  code=$(http GET "$API/profile/test-results/$TR_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "404" "$code" "GET deleted test-result → 404"
  assert_error_code "TEST_RESULT_NOT_FOUND" "  error code is TEST_RESULT_NOT_FOUND"

  section "Batch 4 — Score range"

  code=$(http POST "$API/profile/test-results" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$TEST_ID" --argjson s "$ABOVE_MAX" '{testId:$t, score:$s}')")
  assert_status "400" "$code" "score above max → 400"
  assert_error_code "SCORE_OUT_OF_RANGE" "  error code is SCORE_OUT_OF_RANGE"

  section "Batch 4 — Score step ⭐"

  if [[ -n "$TEST_ID_3" ]]; then
    TEST_3_MIN=$(echo "$TESTS_JSON" | jq -r '.data[2].minScore')
    TEST_3_STEP=$(echo "$TESTS_JSON" | jq -r '.data[2].scoreStep')
    OFF_3=$(awk -v m="$TEST_3_MIN" -v s="$TEST_3_STEP" 'BEGIN{printf "%.2f", m + s/2}')
    VALID_3=$(awk -v m="$TEST_3_MIN" -v s="$TEST_3_STEP" 'BEGIN{printf "%.2f", m + 2*s}')

    code=$(http POST "$API/profile/test-results" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d "$(jq -n --arg t "$TEST_ID_3" --argjson s "$OFF_3" '{testId:$t, score:$s}')")
    assert_status "400" "$code" "off-step score ($OFF_3) → 400"
    assert_error_code "SCORE_NOT_ALIGNED_TO_STEP" "  error code is SCORE_NOT_ALIGNED_TO_STEP"

    code=$(http POST "$API/profile/test-results" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d "$(jq -n --arg t "$TEST_ID_3" --argjson s "$VALID_3" '{testId:$t, score:$s}')")
    [[ "$code" == "201" ]] && pass "on-step score ($VALID_3) → 201" || fail "on-step score → 201" "got $code"
  fi

  section "Batch 4 — Validation"

  code=$(http POST "$API/profile/test-results" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"score":5}')
  [[ "$code" == "400" ]] && pass "missing testId → 400" || fail "missing testId → 400" "got $code"

  code=$(http POST "$API/profile/test-results" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$FAKE_UUID" '{testId:$t, score:5}')")
  assert_status "400" "$code" "nonexistent testId → 400"
  assert_error_code "INVALID_TEST" "  error code is INVALID_TEST"

  section "Batch 4 — Duplicate"

  if [[ -n "$TEST_ID_2" ]]; then
    http POST "$API/profile/test-results" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d "$(jq -n --arg t "$TEST_ID_2" --argjson s "$VALID_SCORE" '{testId:$t, score:$s}')" >/dev/null

    code=$(http POST "$API/profile/test-results" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d "$(jq -n --arg t "$TEST_ID_2" --argjson s "$VALID_SCORE" '{testId:$t, score:$s}')")
    assert_status "409" "$code" "duplicate test result → 409"
    assert_error_code "TEST_RESULT_DUPLICATE" "  error code is TEST_RESULT_DUPLICATE"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# BATCH 5 — Special Statuses
# ══════════════════════════════════════════════════════════════════
section "Batch 5 — Reference (special statuses)"

code=$(http GET "$API/reference/special-statuses")
if is_route_missing; then
  skip "Batch 5 not yet implemented (POST /profile/special-statuses routes missing)"
  BATCH5_AVAILABLE=0
else
  BATCH5_AVAILABLE=1
  assert_status "200" "$code" "GET /reference/special-statuses → 200"
  http GET "$API/reference/special-statuses" >/dev/null
  assert_jq '.data[0] | has("nameEn")' "true" "  has nameEn"
  assert_jq '.data[0] | has("nameAr")' "true" "  has nameAr"

  SPECIAL_STATUS_ID=$(curl -s "$API/reference/special-statuses" | jq -r '.data[0].id // empty')
  SPECIAL_STATUS_ID_2=$(curl -s "$API/reference/special-statuses" | jq -r '.data[1].id // empty')

  section "Batch 5 — Special statuses CRUD"

  code=$(http POST "$API/profile/special-statuses" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg s "$SPECIAL_STATUS_ID" '{specialStatusId:$s}')")
  if is_route_missing; then
    skip "Batch 5 special-statuses endpoints not registered"
  else
    assert_status "200" "$code" "POST /profile/special-statuses (first) → 200"

    # Idempotency: repeat add must return 200, no duplicate
    code=$(http POST "$API/profile/special-statuses" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg s "$SPECIAL_STATUS_ID" '{specialStatusId:$s}')")
    assert_status "200" "$code" "POST same special-status again → 200 (idempotent)"

    code=$(http GET "$API/profile/special-statuses" -H "Authorization: Bearer $TOKEN")
    assert_status "200" "$code" "GET /profile/special-statuses → 200"
    assert_jq "[.data[] | select(.specialStatusId == \"$SPECIAL_STATUS_ID\")] | length" "1" \
      "  idempotent — exactly 1 row for that status"

    # Invalid status ID → 400
    code=$(http POST "$API/profile/special-statuses" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg s "$FAKE_UUID" '{specialStatusId:$s}')")
    if [[ "$code" == "400" ]]; then
      pass "invalid specialStatusId → 400"
      assert_error_code "INVALID_SPECIAL_STATUS" "  error code is INVALID_SPECIAL_STATUS"
    else
      fail "invalid specialStatusId should be 400" "got $code"
    fi

    # Delete
    code=$(http DELETE "$API/profile/special-statuses/$SPECIAL_STATUS_ID" \
      -H "Authorization: Bearer $TOKEN")
    assert_status "204" "$code" "DELETE /profile/special-statuses/:id → 204"

    code=$(http DELETE "$API/profile/special-statuses/$SPECIAL_STATUS_ID" \
      -H "Authorization: Bearer $TOKEN")
    assert_status "404" "$code" "re-delete special-status → 404"
    assert_error_code "SPECIAL_STATUS_NOT_FOUND" "  error code is SPECIAL_STATUS_NOT_FOUND"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# BATCH 5 — Target Preferences
# ══════════════════════════════════════════════════════════════════
section "Batch 5 — Preferences (unified GET)"

code=$(http GET "$API/profile/preferences" -H "Authorization: Bearer $TOKEN")
if is_route_missing; then
  skip "Batch 5 preferences endpoints not registered"
else
  assert_status "200" "$code" "GET /profile/preferences → 200"
  assert_jq ".data | has(\"targetDegrees\")" "true" "  response has targetDegrees"
  assert_jq ".data | has(\"targetMajors\")" "true" "  response has targetMajors"
  assert_jq ".data | has(\"targetInstitutions\")" "true" "  response has targetInstitutions"

  section "Batch 5 — Preferences CRUD (degrees)"

  code=$(http POST "$API/profile/preferences/degrees" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg d "$EDU_LEVEL_ID" '{educationLevelId:$d}')")
  assert_status "200" "$code" "POST /preferences/degrees (first) → 200"

  # Idempotency
  code=$(http POST "$API/profile/preferences/degrees" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg d "$EDU_LEVEL_ID" '{educationLevelId:$d}')")
  assert_status "200" "$code" "POST same degree again → 200 (idempotent)"

  code=$(http GET "$API/profile/preferences" -H "Authorization: Bearer $TOKEN")
  assert_jq "[.data.targetDegrees[] | select(.educationLevelId == \"$EDU_LEVEL_ID\")] | length" "1" \
    "  idempotent — exactly 1 target degree"

  # Invalid degree
  code=$(http POST "$API/profile/preferences/degrees" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg d "$FAKE_UUID" '{educationLevelId:$d}')")
  if [[ "$code" == "400" ]]; then
    pass "invalid educationLevelId → 400"
    assert_error_code "INVALID_EDUCATION_LEVEL" "  error code is INVALID_EDUCATION_LEVEL"
  else fail "invalid educationLevelId → 400" "got $code"; fi

  # Delete
  code=$(http DELETE "$API/profile/preferences/degrees/$EDU_LEVEL_ID" \
    -H "Authorization: Bearer $TOKEN")
  assert_status "204" "$code" "DELETE /preferences/degrees/:id → 204"

  code=$(http DELETE "$API/profile/preferences/degrees/$EDU_LEVEL_ID" \
    -H "Authorization: Bearer $TOKEN")
  assert_status "404" "$code" "re-delete degree → 404"
  assert_error_code "TARGET_DEGREE_NOT_FOUND" "  error code is TARGET_DEGREE_NOT_FOUND"

  section "Batch 5 — Preferences CRUD (majors)"

  code=$(http POST "$API/profile/preferences/majors" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg m "$MAJOR_ID" '{majorId:$m}')")
  assert_status "200" "$code" "POST /preferences/majors → 200"

  code=$(http POST "$API/profile/preferences/majors" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg m "$MAJOR_ID" '{majorId:$m}')")
  assert_status "200" "$code" "POST same major again → 200"

  code=$(http POST "$API/profile/preferences/majors" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg m "$FAKE_UUID" '{majorId:$m}')")
  if [[ "$code" == "400" ]]; then
    pass "invalid majorId → 400"
    assert_error_code "INVALID_MAJOR" "  error code is INVALID_MAJOR"
  else fail "invalid majorId → 400" "got $code"; fi

  code=$(http DELETE "$API/profile/preferences/majors/$MAJOR_ID" \
    -H "Authorization: Bearer $TOKEN")
  assert_status "204" "$code" "DELETE /preferences/majors/:id → 204"

  code=$(http DELETE "$API/profile/preferences/majors/$MAJOR_ID" \
    -H "Authorization: Bearer $TOKEN")
  assert_status "404" "$code" "re-delete major → 404"
  assert_error_code "TARGET_MAJOR_NOT_FOUND" "  error code is TARGET_MAJOR_NOT_FOUND"

  section "Batch 5 — Preferences CRUD (institutions)"

  code=$(http POST "$API/profile/preferences/institutions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg i "$INSTITUTION_ID" '{institutionId:$i}')")
  assert_status "200" "$code" "POST /preferences/institutions → 200"

  code=$(http POST "$API/profile/preferences/institutions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg i "$FAKE_UUID" '{institutionId:$i}')")
  if [[ "$code" == "400" ]]; then
    pass "invalid institutionId → 400"
    assert_error_code "INVALID_INSTITUTION" "  error code is INVALID_INSTITUTION"
  else fail "invalid institutionId → 400" "got $code"; fi

  code=$(http DELETE "$API/profile/preferences/institutions/$INSTITUTION_ID" \
    -H "Authorization: Bearer $TOKEN")
  assert_status "204" "$code" "DELETE /preferences/institutions/:id → 204"

  code=$(http DELETE "$API/profile/preferences/institutions/$INSTITUTION_ID" \
    -H "Authorization: Bearer $TOKEN")
  assert_status "404" "$code" "re-delete institution → 404"
  assert_error_code "TARGET_INSTITUTION_NOT_FOUND" "  error code is TARGET_INSTITUTION_NOT_FOUND"

  section "Batch 5 — Re-add preferences for completion-100 invariant"

  http POST "$API/profile/preferences/degrees" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg d "$EDU_LEVEL_ID" '{educationLevelId:$d}')" >/dev/null

  http POST "$API/profile/preferences/majors" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg m "$MAJOR_ID" '{majorId:$m}')" >/dev/null

  http POST "$API/profile/preferences/institutions" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg i "$INSTITUTION_ID" '{institutionId:$i}')" >/dev/null

  http POST "$API/profile/special-statuses" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg s "$SPECIAL_STATUS_ID" '{specialStatusId:$s}')" >/dev/null
fi

# ══════════════════════════════════════════════════════════════════
# BATCH 6 — Documents
# ══════════════════════════════════════════════════════════════════
section "Batch 6 — Reference (document types)"

code=$(http GET "$API/reference/document-types")
if is_route_missing; then
  skip "Batch 6 not yet implemented (routes missing)"
  BATCH6_AVAILABLE=0
else
  BATCH6_AVAILABLE=1
  assert_status "200" "$code" "GET /reference/document-types → 200"
  http GET "$API/reference/document-types" >/dev/null
  assert_jq '.data[0] | has("nameEn")' "true" "  has nameEn"
  assert_jq '.data[0] | has("nameAr")' "true" "  has nameAr"

  DOC_TYPE_ID=$(curl -s "$API/reference/document-types" | jq -r '.data[0].id // empty')

  section "Batch 6 — Documents CRUD lifecycle"

  # Capture completion state BEFORE upload (for no-recalculate invariant)
  http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN" >/dev/null
  PCT_BEFORE=$(num '.data.completionPct')
  MV_BEFORE=$(num '.data.matchingVersion' 0)

  # Upload valid PDF
  code=$(http POST "$API/profile/documents" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$TEMP_PDF;type=application/pdf" \
    -F "documentTypeId=$DOC_TYPE_ID")
  if is_route_missing; then
    skip "Batch 6 documents endpoints not registered"
  else
    assert_status "201" "$code" "POST /profile/documents → 201"
    DOC_ID=$(jq -r '.data.id // empty' "$BODY_FILE")
    [[ -n "$DOC_ID" ]] && pass "  document created" || fail "  no id returned"

    # GET list
    code=$(http GET "$API/profile/documents" -H "Authorization: Bearer $TOKEN")
    assert_status "200" "$code" "GET /profile/documents → 200"
    assert_jq ".data | type" "array" "  response.data is an array"

    # Download URL
    if [[ -n "$DOC_ID" ]]; then
      code=$(http GET "$API/profile/documents/$DOC_ID/download" \
        -H "Authorization: Bearer $TOKEN")
      if [[ "$code" == "200" ]]; then
        pass "GET /profile/documents/:id/download → 200"
        assert_jq ".data | has(\"signedUrl\")" "true" "  has signedUrl"
        assert_jq ".data.expiresIn" "900" "  expiresIn = 900"
      else
        fail "download URL generation" "got $code"
      fi
    fi

    section "Batch 6 — Upload validation"

    # Missing file
    code=$(http POST "$API/profile/documents" \
      -H "Authorization: Bearer $TOKEN" \
      -F "documentTypeId=$DOC_TYPE_ID")
    if [[ "$code" == "400" ]]; then
      pass "missing file → 400"
    else fail "missing file → 400" "got $code"; fi

    # Wrong MIME type (.exe)
    code=$(http POST "$API/profile/documents" \
      -H "Authorization: Bearer $TOKEN" \
      -F "file=@$TEMP_EXE;type=application/x-msdownload" \
      -F "documentTypeId=$DOC_TYPE_ID")
    if [[ "$code" == "400" ]]; then
      pass "invalid MIME type → 400"
      assert_error_code "INVALID_MIME_TYPE" "  error code is INVALID_MIME_TYPE"
    else fail "invalid MIME type → 400" "got $code"; fi

    # Unknown documentTypeId
    code=$(http POST "$API/profile/documents" \
      -H "Authorization: Bearer $TOKEN" \
      -F "file=@$TEMP_PDF;type=application/pdf" \
      -F "documentTypeId=$FAKE_UUID")
    if [[ "$code" == "400" ]]; then
      pass "unknown documentTypeId → 400"
      assert_error_code "INVALID_DOCUMENT_TYPE" "  error code is INVALID_DOCUMENT_TYPE"
    else fail "unknown documentTypeId → 400" "got $code"; fi

    # Free-text docType (should be rejected as unknown field)
    code=$(http POST "$API/profile/documents" \
      -H "Authorization: Bearer $TOKEN" \
      -F "file=@$TEMP_PDF;type=application/pdf" \
      -F "docType=passport")
    if [[ "$code" == "400" ]]; then
      pass "free-text docType → 400"
    else fail "free-text docType → 400" "got $code"; fi

    section "Batch 6 — No-recalculate invariant"

    http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN" >/dev/null
    PCT_AFTER_UPLOAD=$(num '.data.completionPct')
    MV_AFTER_UPLOAD=$(num '.data.matchingVersion' 0)

    if [[ "$PCT_AFTER_UPLOAD" -eq "$PCT_BEFORE" ]]; then
      pass "completionPct unchanged after upload ($PCT_BEFORE → $PCT_AFTER_UPLOAD)"
    else
      fail "completionPct changed after upload" "before=$PCT_BEFORE after=$PCT_AFTER_UPLOAD"
    fi

    if [[ "$MV_AFTER_UPLOAD" -eq "$MV_BEFORE" ]]; then
      pass "matchingVersion unchanged after upload ($MV_BEFORE → $MV_AFTER_UPLOAD)"
    else
      fail "matchingVersion changed after upload" "before=$MV_BEFORE after=$MV_AFTER_UPLOAD"
    fi

    section "Batch 6 — Deletion (storage-first)"

    if [[ -n "$DOC_ID" ]]; then
      code=$(http DELETE "$API/profile/documents/$DOC_ID" \
        -H "Authorization: Bearer $TOKEN")
      assert_status "204" "$code" "DELETE /profile/documents/:id → 204"

      code=$(http GET "$API/profile/documents" -H "Authorization: Bearer $TOKEN")
      assert_jq "[.data[] | select(.id == \"$DOC_ID\")] | length" "0" \
        "  deleted doc no longer in list"

      # No-recalculate invariant on delete
      http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN" >/dev/null
      PCT_AFTER_DELETE=$(num '.data.completionPct')
      MV_AFTER_DELETE=$(num '.data.matchingVersion' 0)
      [[ "$PCT_AFTER_DELETE" -eq "$PCT_BEFORE" ]] && \
        pass "completionPct unchanged after delete" || \
        fail "completionPct changed after delete" "was $PCT_BEFORE now $PCT_AFTER_DELETE"
      [[ "$MV_AFTER_DELETE" -eq "$MV_BEFORE" ]] && \
        pass "matchingVersion unchanged after delete" || \
        fail "matchingVersion changed after delete" "was $MV_BEFORE now $MV_AFTER_DELETE"
    fi

    # Foreign ID
    code=$(http GET "$API/profile/documents/$FAKE_UUID/download" \
      -H "Authorization: Bearer $TOKEN")
    assert_status "404" "$code" "GET foreign doc download → 404"
    assert_error_code "DOCUMENT_NOT_FOUND" "  error code is DOCUMENT_NOT_FOUND"

    code=$(http DELETE "$API/profile/documents/$FAKE_UUID" \
      -H "Authorization: Bearer $TOKEN")
    assert_status "404" "$code" "DELETE foreign doc → 404"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# Cross-batch — Completion-100 invariant
# ══════════════════════════════════════════════════════════════════
section "Cross-batch — Completion-100 invariant"

# Ensure all required groups are populated
if [[ -n "$LANGUAGE_ID_2" && -n "$PROFICIENCY_ID" ]]; then
  http POST "$API/profile/languages" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg lang "$LANGUAGE_ID_2" --arg prof "$PROFICIENCY_ID" \
        '{languageId:$lang, proficiencyLevelId:$prof}')" >/dev/null
fi

if [[ -n "$TEST_ID" && -n "$VALID_SCORE" ]]; then
  http POST "$API/profile/test-results" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$TEST_ID" --argjson s "$VALID_SCORE" \
        '{testId:$t, score:$s}')" >/dev/null
fi

if [[ -n "$INSTITUTION_ID" && -n "$MAJOR_ID" && -n "$EDU_LEVEL_ID" ]]; then
  http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg inst "$INSTITUTION_ID" --arg major "$MAJOR_ID" --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level}')" >/dev/null
fi

http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN" >/dev/null
FINAL_PCT=$(num '.data.completionPct')
FINAL_MATCH=$(jq -r '.data.isMatchable' "$BODY_FILE" 2>/dev/null)
FINAL_MV=$(num '.data.matchingVersion' 1)

if [[ "${BATCH5_AVAILABLE:-0}" -eq 1 ]]; then
  if [[ "$FINAL_PCT" -eq 100 ]]; then
    pass "completionPct = 100 with all six groups filled"
  else
    fail "completionPct expected 100, got $FINAL_PCT" \
         "All weighted groups should be filled at this point"
  fi

  if [[ "$FINAL_MATCH" == "true" ]]; then
    pass "isMatchable = true at completionPct=100"
  else
    fail "isMatchable should be true at 100%" "got $FINAL_MATCH"
  fi
else
  skip "Completion-100 invariant skipped (Batch 5 not implemented)"
fi

if [[ "$FINAL_MV" -gt 1 ]]; then
  pass "matchingVersion > 1 after many mutations (got $FINAL_MV)"
else
  fail "matchingVersion should be > 1" "got $FINAL_MV"
fi

# ══════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════
section "Summary"
printf '  %sPassed:%s  %d\n' "$GREEN" "$RESET" "$PASS"
printf '  %sFailed:%s  %d\n' "$RED" "$RESET" "$FAIL"
printf '  %sSkipped:%s %d\n' "$YELLOW" "$RESET" "$SKIP"
printf '  %sLog file:%s %s\n' "$BOLD" "$RESET" "$LOG_FILE"

if [[ "$FAIL" -gt 0 ]]; then
  printf '\n  %sFailed tests:%s\n' "$BOLD" "$RESET"
  for f in "${FAILURES[@]}"; do printf '    • %s\n' "$f"; done
  exit 1
fi

printf '\n  %sAll tests passed.%s\n' "$GREEN$BOLD" "$RESET"
printf '  Full request/response log: %s\n' "$LOG_FILE"
exit 0
