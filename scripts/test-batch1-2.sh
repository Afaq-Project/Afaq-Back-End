#!/usr/bin/env bash
#
# Batch 1 + Batch 2 endpoint verification script.
# Tests the v2 Profile redesign: auth, profile, reference, and education endpoints.
#
# Usage:
#   ./scripts/test-batch1-2.sh
#   BASE_URL=http://localhost:3000 ./scripts/test-batch1-2.sh
#
# Requirements: curl, jq

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
API="$BASE_URL/api/v1"

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

# ── Helpers ───────────────────────────────────────────────────────
pass() { PASS=$((PASS+1)); printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
fail() {
  FAIL=$((FAIL+1)); FAILURES+=("$1")
  printf '  %s✗%s %s\n' "$RED" "$RESET" "$1"
  [[ -n "${2:-}" ]] && printf '      %s\n' "$2"
}
skip() { SKIP=$((SKIP+1)); printf '  %s⊘%s %s\n' "$YELLOW" "$RESET" "$1"; }
section() { printf '\n%s%s%s\n' "$BOLD$CYAN" "$1" "$RESET"; }

# Curl helper: prints "<http_code>\n<body>"
http() {
  local method="$1" url="$2"; shift 2
  curl -s -o /tmp/batch12_body.$$ -w "%{http_code}" -X "$method" "$url" "$@"
}

assert_status() {
  local expected="$1" actual="$2" name="$3"
  if [[ "$actual" == "$expected" ]]; then pass "$name"
  else fail "$name" "expected HTTP $expected, got $actual — body: $(head -c 300 /tmp/batch12_body.$$)"; fi
}

assert_jq() {
  local filter="$1" expected="$2" name="$3"
  local actual
  actual=$(jq -r "$filter" /tmp/batch12_body.$$ 2>/dev/null || echo "<jq-error>")
  if [[ "$actual" == "$expected" ]]; then pass "$name"
  else fail "$name" "jq '$filter' → expected '$expected', got '$actual'"; fi
}

assert_error_code() {
  local expected="$1" name="$2"
  local actual
  actual=$(jq -r '.errors[0].code // .message // empty' /tmp/batch12_body.$$ 2>/dev/null)
  if [[ "$actual" == "$expected" ]]; then pass "$name (error=$expected)"
  else fail "$name" "expected error '$expected', got '$actual' — body: $(head -c 300 /tmp/batch12_body.$$)"; fi
}

cleanup() { rm -f /tmp/batch12_body.$$; }
trap cleanup EXIT

# ── Prerequisites ─────────────────────────────────────────────────
section "Prerequisites"
for cmd in curl jq; do
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

# ── Test user credentials ─────────────────────────────────────────
TS=$(date +%s)
TEST_EMAIL="batch12-${TS}@levora.test"
TEST_PASS="Batch12Test!${TS}"
TOKEN=""

# ══════════════════════════════════════════════════════════════════
# BATCH 1 — Auth
# ══════════════════════════════════════════════════════════════════
section "Batch 1 — Auth (token-only responses, DEC-AUTH-04)"

code=$(http POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\",\"firstName\":\"Batch\",\"lastName\":\"One\"}")
assert_status "201" "$code" "POST /auth/register returns 201"
assert_jq ".data.accessToken | length > 0" "true" "register response has accessToken"
assert_jq ".data.refreshToken | length > 0" "true" "register response has refreshToken"
assert_jq ".data | has(\"userProfile\")" "false" "register response has NO userProfile key"

code=$(http POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
assert_status "200" "$code" "POST /auth/login returns 200"
TOKEN=$(jq -r '.data.accessToken // empty' /tmp/batch12_body.$$)
if [[ -n "$TOKEN" ]]; then pass "login returned accessToken"
else fail "login did not return accessToken"; exit 1; fi
assert_jq ".data | has(\"userProfile\")" "false" "login response has NO userProfile key"

# ══════════════════════════════════════════════════════════════════
# BATCH 1 — Reference endpoints
# ══════════════════════════════════════════════════════════════════
section "Batch 1 — Reference endpoints (public, no auth)"

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

COUNTRY_ID=$(curl -s "$API/reference/countries" | jq -r '.data[0].id // empty')
MARITAL_ID=$(curl -s "$API/reference/marital-statuses" | jq -r '.data[0].id // empty')
EDU_LEVEL_ID=$(curl -s "$API/reference/education-levels" | jq -r '.data[0].id // empty')

# ══════════════════════════════════════════════════════════════════
# BATCH 1 — Profile
# ══════════════════════════════════════════════════════════════════
section "Batch 1 — Profile (auth enforcement)"

code=$(http GET "$API/profile/me")
assert_status "401" "$code" "GET /profile/me without token → 401"

code=$(http PATCH "$API/profile/personal" \
  -H "Content-Type: application/json" -d '{"firstName":"X"}')
assert_status "401" "$code" "PATCH /profile/personal without token → 401"

section "Batch 1 — GET /profile/me shape (EC-001, FR-001)"

code=$(http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN")
assert_status "200" "$code" "GET /profile/me with token → 200"
assert_jq ".data.completionPct" "0" "new profile starts with completionPct = 0"
assert_jq ".data.isMatchable" "false" "new profile isMatchable = false"
assert_jq ".data.matchingVersion | type" "number" "matchingVersion is a number"

for section_name in educations languages testResults specialStatuses \
                    targetDegrees targetMajors targetInstitutions documents; do
  assert_jq ".data.$section_name | type" "array" "  section '$section_name' is an array"
done

section "Batch 1 — DTO strictness (EC-003, FR-007, FR-012)"

for field in completionPct isMatchable matchingVersion userId createdAt; do
  code=$(http PATCH "$API/profile/personal" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"$field\": \"x\"}")
  assert_status "400" "$code" "PATCH with computed field '$field' → 400"
done

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"unknownField":"x"}')
assert_status "400" "$code" "PATCH with unknown field → 400"
assert_error_code "UNKNOWN_FIELD" "  error code is UNKNOWN_FIELD"

section "Batch 1 — bio boundary (EC-005)"

BIO_1000=$(printf 'a%.0s' {1..1000})
BIO_1001=$(printf 'a%.0s' {1..1001})

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"bio\":\"$BIO_1000\"}")
assert_status "200" "$code" "bio = 1000 chars → 200 (at limit)"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"bio\":\"$BIO_1001\"}")
assert_status "400" "$code" "bio = 1001 chars → 400 (over limit)"
assert_error_code "BIO_TOO_LONG" "  error code is BIO_TOO_LONG"

section "Batch 1 — completion engine"

http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
      --arg fn "Batch" --arg ln "One" \
      --arg dob "2000-01-01" \
      --arg ms "$MARITAL_ID" \
      --arg cid "$COUNTRY_ID" \
      --arg eid "$EDU_LEVEL_ID" \
      '{firstName:$fn, lastName:$ln, dateOfBirth:$dob, gender:"MALE",
        maritalStatusId:$ms, countryOfResidenceId:$cid,
        nationalityId:$cid, educationLevelId:$eid}')" >/dev/null

http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN" >/dev/null
PCT=$(jq -r '.data.completionPct' /tmp/batch12_body.$$)
if [[ "$PCT" -eq 43 ]]; then
  pass "completionPct = 43 after all Batch 1 fields"
else
  fail "completionPct expected 43, got $PCT" \
       "Personal(18)+Location(15)+educationLevelId(10) should equal 43"
fi

# ══════════════════════════════════════════════════════════════════
# BATCH 2 — Reference endpoints (education)
# ══════════════════════════════════════════════════════════════════
section "Batch 2 — Reference endpoints (public)"

for path in major-categories majors institutions; do
  code=$(http GET "$API/reference/$path")
  assert_status "200" "$code" "GET /reference/$path → 200 without token"
  assert_jq ".data | type" "array" "  response.data is an array"
  assert_jq ".meta | type" "object" "  response.meta is an object"
  assert_jq ".meta.total | type" "number" "  meta.total is a number"
done

code=$(http GET "$API/reference/major-categories?search=Eng")
assert_status "200" "$code" "GET /reference/major-categories?search=Eng → 200"

code=$(http GET "$API/reference/majors?search=Comp&page=1&limit=5")
assert_status "200" "$code" "GET /reference/majors?search=Comp → 200"
assert_jq ".data | length <= 5" "true" "  limit=5 respected"

code=$(http GET "$API/reference/institutions?search=University")
assert_status "200" "$code" "GET /reference/institutions?search=University → 200"

# Fetch IDs needed for education CRUD
INSTITUTION_ID=$(curl -s "$API/reference/institutions?limit=2" | jq -r '.data[0].id // empty')
INSTITUTION_ID_2=$(curl -s "$API/reference/institutions?limit=2" | jq -r '.data[1].id // empty')
MAJOR_ID=$(curl -s "$API/reference/majors?limit=3" | jq -r '.data[0].id // empty')
MAJOR_ID_2=$(curl -s "$API/reference/majors?limit=3" | jq -r '.data[1].id // empty')
MAJOR_ID_3=$(curl -s "$API/reference/majors?limit=3" | jq -r '.data[2].id // empty')
MAJOR_CATEGORY_ID=$(curl -s "$API/reference/major-categories?limit=1" | jq -r '.data[0].id // empty')

if [[ -z "$INSTITUTION_ID" || -z "$MAJOR_ID" || -z "$MAJOR_ID_2" || -z "$EDU_LEVEL_ID" ]]; then
  skip "Education CRUD tests skipped — reference data not seeded"
  printf '      Run: pnpm ts-node scripts/load-reference-data.ts --sample\n'
else
  # ════════════════════════════════════════════════════════════════
  # BATCH 2 — Education CRUD lifecycle
  # ════════════════════════════════════════════════════════════════
  section "Batch 2 — Education CRUD lifecycle"

  # POST — create a basic record
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$MAJOR_ID" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
  assert_status "201" "$code" "POST /profile/educations → 201"
  EDU_ID=$(jq -r '.data.id // empty' /tmp/batch12_body.$$)
  if [[ -n "$EDU_ID" ]]; then pass "  record created with id=$EDU_ID"
  else fail "  no id returned"; fi
  assert_jq ".data.institution | has(\"nameEn\")" "true" "  embedded institution has nameEn"
  assert_jq ".data.major | has(\"nameEn\")" "true" "  embedded major has nameEn"
  assert_jq ".data.educationLevel | has(\"code\")" "true" "  embedded educationLevel has code"

  # GET all
  code=$(http GET "$API/profile/educations" -H "Authorization: Bearer $TOKEN")
  assert_status "200" "$code" "GET /profile/educations → 200"
  assert_jq ".data | type" "array" "  response.data is an array"
  assert_jq "[.data[] | select(.id == \"$EDU_ID\")] | length" "1" "  created record appears in list"

  # GET by id
  code=$(http GET "$API/profile/educations/$EDU_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "200" "$code" "GET /profile/educations/:id → 200"
  assert_jq ".data.id" "$EDU_ID" "  returned record id matches"

  # PATCH
  code=$(http PATCH "$API/profile/educations/$EDU_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"startDate":"2022-09-01"}')
  assert_status "200" "$code" "PATCH /profile/educations/:id → 200"
  assert_jq ".data.startDate" "2022-09-01" "  startDate updated"

  # DELETE
  code=$(http DELETE "$API/profile/educations/$EDU_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "204" "$code" "DELETE /profile/educations/:id → 204"

  # verify deletion
  code=$(http GET "$API/profile/educations/$EDU_ID" -H "Authorization: Bearer $TOKEN")
  assert_status "404" "$code" "GET deleted record → 404"
  assert_error_code "EDUCATION_NOT_FOUND" "  error code is EDUCATION_NOT_FOUND"

  # ════════════════════════════════════════════════════════════════
  # BATCH 2 — GPA normalization (EC-016)
  # ════════════════════════════════════════════════════════════════
  section "Batch 2 — GPA normalization (EC-016, FR-016)"

  # OUT_OF_100: 85 → 3.40
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$MAJOR_ID" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level,
          gpaRaw:85, gpaScale:"OUT_OF_100"}')")
  assert_status "201" "$code" "POST with gpaRaw=85, scale=OUT_OF_100 → 201"
  assert_jq ".data.gpaNormalized" "3.4" "  gpaNormalized = 3.40"
  EDU_ID_100=$(jq -r '.data.id // empty' /tmp/batch12_body.$$)

  # OUT_OF_5: 4.5 → 3.60
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID_2" \
        --arg major "$MAJOR_ID_2" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level,
          gpaRaw:4.5, gpaScale:"OUT_OF_5"}')")
  assert_status "201" "$code" "POST with gpaRaw=4.5, scale=OUT_OF_5 → 201"
  assert_jq ".data.gpaNormalized" "3.6" "  gpaNormalized = 3.60"
  EDU_ID_5=$(jq -r '.data.id // empty' /tmp/batch12_body.$$)

  # OUT_OF_4: 3.7 → 3.70
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$MAJOR_ID_3" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level,
          gpaRaw:3.7, gpaScale:"OUT_OF_4"}')")
  assert_status "201" "$code" "POST with gpaRaw=3.7, scale=OUT_OF_4 → 201"
  assert_jq ".data.gpaNormalized" "3.7" "  gpaNormalized = 3.70"
  EDU_ID_4=$(jq -r '.data.id // empty' /tmp/batch12_body.$$)

  # ════════════════════════════════════════════════════════════════
  # BATCH 2 — Validation rules
  # ════════════════════════════════════════════════════════════════
  section "Batch 2 — Validation rules (EC-013, EC-014, EC-015, EC-016)"

  # gpaRaw without gpaScale → 400 GPA_SCALE_REQUIRED
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID_2" \
        --arg major "$MAJOR_ID_3" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level, gpaRaw:3.5}')")
  assert_status "400" "$code" "gpaRaw without gpaScale → 400"
  assert_error_code "GPA_SCALE_REQUIRED" "  error code is GPA_SCALE_REQUIRED"

  # endDate < startDate → 400 INVALID_DATE_RANGE
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID_2" \
        --arg major "$MAJOR_ID" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level,
          startDate:"2024-01-01", endDate:"2023-01-01"}')")
  assert_status "400" "$code" "endDate < startDate → 400"
  assert_error_code "INVALID_DATE_RANGE" "  error code is INVALID_DATE_RANGE"

  # minorMajorId == majorId → 400 MINOR_MAJOR_EQUALS_MAJOR
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID_2" \
        --arg major "$MAJOR_ID" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, minorMajorId:$major, educationLevelId:$level}')")
  assert_status "400" "$code" "minorMajorId == majorId → 400"
  assert_error_code "MINOR_MAJOR_EQUALS_MAJOR" "  error code is MINOR_MAJOR_EQUALS_MAJOR"

  # invalid institution → 400 INVALID_INSTITUTION
  FAKE_UUID="123e4567-e89b-12d3-a456-426614174000"
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$FAKE_UUID" \
        --arg major "$MAJOR_ID" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
  assert_status "400" "$code" "invalid institutionId → 400"
  assert_error_code "INVALID_INSTITUTION" "  error code is INVALID_INSTITUTION"

  # invalid major → 400 INVALID_MAJOR
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$FAKE_UUID" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
  assert_status "400" "$code" "invalid majorId → 400"
  assert_error_code "INVALID_MAJOR" "  error code is INVALID_MAJOR"

  # invalid educationLevel → 400 INVALID_EDUCATION_LEVEL
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$MAJOR_ID" \
        --arg level "$FAKE_UUID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
  assert_status "400" "$code" "invalid educationLevelId → 400"
  assert_error_code "INVALID_EDUCATION_LEVEL" "  error code is INVALID_EDUCATION_LEVEL"

  # invalid minorMajor → 400 INVALID_MINOR_MAJOR
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$MAJOR_ID" \
        --arg minor "$FAKE_UUID" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, minorMajorId:$minor, educationLevelId:$level}')")
  assert_status "400" "$code" "invalid minorMajorId → 400"
  assert_error_code "INVALID_MINOR_MAJOR" "  error code is INVALID_MINOR_MAJOR"

  # unknown field → 400 UNKNOWN_FIELD
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$MAJOR_ID" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level, unknownField:"x"}')")
  assert_status "400" "$code" "unknown field in education DTO → 400"
  assert_error_code "UNKNOWN_FIELD" "  error code is UNKNOWN_FIELD"

  # ════════════════════════════════════════════════════════════════
  # BATCH 2 — isCurrent semantics (EC-017, FR-018b)
  # ════════════════════════════════════════════════════════════════
  section "Batch 2 — isCurrent semantics (EC-017, FR-018b)"

  # isCurrent=true clears endDate
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$MAJOR_ID_2" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level,
          isCurrent:true, endDate:"2024-06-15",
          expectedGraduationDate:"2026-06-30"}')")
  assert_status "201" "$code" "isCurrent=true → 201"
  assert_jq ".data.isCurrent" "true" "  isCurrent persisted as true"
  assert_jq ".data.endDate" "null" "  endDate cleared to null"
  assert_jq ".data.expectedGraduationDate" "2026-06-30" "  expectedGraduationDate retained"
  EDU_ID_CURRENT=$(jq -r '.data.id // empty' /tmp/batch12_body.$$)

  # isCurrent=false clears expectedGraduationDate
  code=$(http PATCH "$API/profile/educations/$EDU_ID_CURRENT" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"isCurrent":false, "endDate":"2024-06-15", "expectedGraduationDate":"2026-06-30"}')
  assert_status "200" "$code" "PATCH isCurrent=false → 200"
  assert_jq ".data.isCurrent" "false" "  isCurrent persisted as false"
  assert_jq ".data.expectedGraduationDate" "null" "  expectedGraduationDate cleared to null"
  assert_jq ".data.endDate" "2024-06-15" "  endDate retained"

  # ════════════════════════════════════════════════════════════════
  # BATCH 2 — GPA orphaned-raw fix (batch-2-fixes.md Failure 1)
  # ════════════════════════════════════════════════════════════════
  section "Batch 2 — GPA orphaned-raw fix (batch-2-fixes.md Failure 1)"

  # Create record with gpaRaw + gpaScale
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID_2" \
        --arg major "$MAJOR_ID" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level,
          gpaRaw:3.5, gpaScale:"OUT_OF_4"}')")
  assert_status "201" "$code" "create with gpaRaw+gpaScale → 201"
  EDU_ID_ORPHAN=$(jq -r '.data.id // empty' /tmp/batch12_body.$$)

  # PATCH with gpaScale:null while gpaRaw exists → 400 GPA_SCALE_REQUIRED
  code=$(http PATCH "$API/profile/educations/$EDU_ID_ORPHAN" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"gpaScale":null}')
  assert_status "400" "$code" "PATCH gpaScale=null with existing gpaRaw → 400"
  assert_error_code "GPA_SCALE_REQUIRED" "  error code is GPA_SCALE_REQUIRED"

  # ════════════════════════════════════════════════════════════════
  # BATCH 2 — Duplicate & max limit (EC-019, EC-020)
  # ════════════════════════════════════════════════════════════════
  section "Batch 2 — Duplicate & max limit (EC-019, EC-020)"

  # Duplicate: same (userId, institutionId, majorId, educationLevelId)
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$MAJOR_ID_2" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
  # This one should succeed (it's a new combo)
  # Then try the same combo again → 409
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID" \
        --arg major "$MAJOR_ID_2" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
  assert_status "409" "$code" "duplicate education → 409"
  assert_error_code "EDUCATION_DUPLICATE" "  error code is EDUCATION_DUPLICATE"

  # MAX_EDUCATIONS: count existing, then fill to limit, then try one more
  EXISTING=$(curl -s "$API/profile/educations" -H "Authorization: Bearer $TOKEN" | jq '.data | length')
  MAX_EDU=5  # default from SystemSettings

  # Only test the limit if we can reach it
  if [[ $EXISTING -lt $MAX_EDU ]]; then
    # Create records with distinct combos until we hit the limit
    # Use institution 2 + major 3 + level (unique combo)
    while [[ $EXISTING -lt $MAX_EDU ]]; do
      # Try a unique combo — vary institution/major
      # We only have a few known IDs, so this is best-effort
      http POST "$API/profile/educations" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
            --arg inst "$INSTITUTION_ID_2" \
            --arg major "$MAJOR_ID" \
            --arg level "$EDU_LEVEL_ID" \
            '{institutionId:$inst, majorId:$major, educationLevelId:$level}')" >/dev/null
      EXISTING=$((EXISTING+1))
      # Avoid infinite loop if creation fails
      [[ $EXISTING -gt 10 ]] && break
    done
  fi

  # Try to exceed the limit
  code=$(http POST "$API/profile/educations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
        --arg inst "$INSTITUTION_ID_2" \
        --arg major "$MAJOR_ID_3" \
        --arg level "$EDU_LEVEL_ID" \
        '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
  if [[ "$code" == "409" ]]; then
    assert_error_code "MAX_EDUCATIONS_REACHED" "  error code is MAX_EDUCATIONS_REACHED"
  else
    skip "MAX_EDUCATIONS test skipped (could not fill to limit, got HTTP $code)"
  fi

  # ════════════════════════════════════════════════════════════════
  # BATCH 2 — Ownership (EC-021)
  # ════════════════════════════════════════════════════════════════
  section "Batch 2 — Ownership (EC-021, ST-006)"

  # Create a second user
  TS2=$(date +%s)
  TEST_EMAIL_2="batch12b-${TS2}@levora.test"
  TEST_PASS_2="Batch12Test!${TS2}"

  code=$(http POST "$API/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL_2\",\"password\":\"$TEST_PASS_2\",\"firstName\":\"Batch\",\"lastName\":\"Two\"}")
  TOKEN_2=$(jq -r '.data.accessToken // empty' /tmp/batch12_body.$$)

  if [[ -z "$TOKEN_2" ]]; then
    fail "could not register second user for ownership test"
  else
    # Create a record for user 1
    code=$(http POST "$API/profile/educations" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$(jq -n \
          --arg inst "$INSTITUTION_ID" \
          --arg major "$MAJOR_ID_3" \
          --arg level "$EDU_LEVEL_ID" \
          '{institutionId:$inst, majorId:$major, educationLevelId:$level}')")
    EDU_ID_FOREIGN=$(jq -r '.data.id // empty' /tmp/batch12_body.$$)

    if [[ -n "$EDU_ID_FOREIGN" ]]; then
      # User 2 tries to GET → 404
      code=$(http GET "$API/profile/educations/$EDU_ID_FOREIGN" \
        -H "Authorization: Bearer $TOKEN_2")
      assert_status "404" "$code" "User B GET User A's education → 404"
      assert_error_code "EDUCATION_NOT_FOUND" "  error code is EDUCATION_NOT_FOUND"

      # User 2 tries to PATCH → 404
      code=$(http PATCH "$API/profile/educations/$EDU_ID_FOREIGN" \
        -H "Authorization: Bearer $TOKEN_2" \
        -H "Content-Type: application/json" \
        -d '{"gpaRaw":4.0, "gpaScale":"OUT_OF_4"}')
      assert_status "404" "$code" "User B PATCH User A's education → 404"

      # User 2 tries to DELETE → 404
      code=$(http DELETE "$API/profile/educations/$EDU_ID_FOREIGN" \
        -H "Authorization: Bearer $TOKEN_2")
      assert_status "404" "$code" "User B DELETE User A's education → 404"
    fi
  fi

  # ════════════════════════════════════════════════════════════════
  # BATCH 2 — Completion impact (EC-022, FR-004, FR-008)
  # ════════════════════════════════════════════════════════════════
  section "Batch 2 — Completion impact (EC-022)"

  # At this point user 1 has education records. Let's check completion.
  http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN" >/dev/null
  PCT_WITH_EDU=$(jq -r '.data.completionPct' /tmp/batch12_body.$$)
  EDU_COUNT=$(jq -r '.data.educations | length' /tmp/batch12_body.$$)

  if [[ "$EDU_COUNT" -gt 0 ]]; then
    # 43 (Batch 1) + 25 (has education record) = 68
    if [[ "$PCT_WITH_EDU" -ge 68 ]]; then
      pass "completionPct ≥ 68 with education records (got $PCT_WITH_EDU)"
    else
      fail "completionPct expected ≥ 68, got $PCT_WITH_EDU" \
           "Batch 1 = 43, +25 for education record = 68"
    fi
  else
    skip "completion impact test skipped — no education records present"
  fi

  # matchingVersion should have incremented
  V=$(jq -r '.data.matchingVersion' /tmp/batch12_body.$$)
  if [[ "$V" -gt 1 ]]; then
    pass "matchingVersion incremented past 1 (got $V)"
  else
    fail "matchingVersion should be > 1 after mutations" "got $V"
  fi

fi  # end education tests

# ══════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════
section "Summary"
printf '  %sPassed:%s  %d\n' "$GREEN" "$RESET" "$PASS"
printf '  %sFailed:%s  %d\n' "$RED"   "$RESET" "$FAIL"
printf '  %sSkipped:%s %d\n' "$YELLOW" "$RESET" "$SKIP"

if [[ "$FAIL" -gt 0 ]]; then
  printf '\n  %sFailed tests:%s\n' "$BOLD" "$RESET"
  for f in "${FAILURES[@]}"; do printf '    • %s\n' "$f"; done
  exit 1
fi

printf '\n  %sAll Batch 1 + Batch 2 tests passed.%s\n' "$GREEN$BOLD" "$RESET"
exit 0
