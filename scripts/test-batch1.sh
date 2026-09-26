#!/usr/bin/env bash
#
# Batch 1 endpoint verification script.
# Tests the 7 endpoints + auth behavior from the v2 Profile redesign.
#
# Usage:
#   ./scripts/test-batch1.sh
#   BASE_URL=http://localhost:3000 ./scripts/test-batch1.sh
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
section() { printf '\n%s%s%s\n' "$BOLD$CYAN" "$1" "$RESET"; }

# Curl helper: prints "<http_code>\n<body>"
http() {
  local method="$1" url="$2"; shift 2
  curl -s -o /tmp/batch1_body.$$ -w "%{http_code}" -X "$method" "$url" "$@"
}

# Assert HTTP status + optional JSON field. Usage:
#   expect_status <expected> <method> <url> [curl args...]
#   expect_json   <jq filter> <expected> <body_file>
assert_status() {
  local expected="$1" actual="$2" name="$3"
  if [[ "$actual" == "$expected" ]]; then pass "$name"
  else fail "$name" "expected HTTP $expected, got $actual — body: $(head -c 300 /tmp/batch1_body.$$)"; fi
}

assert_jq() {
  local filter="$1" expected="$2" name="$3"
  local actual
  actual=$(jq -r "$filter" /tmp/batch1_body.$$ 2>/dev/null || echo "<jq-error>")
  if [[ "$actual" == "$expected" ]]; then pass "$name"
  else fail "$name" "jq '$filter' → expected '$expected', got '$actual'"; fi
}

cleanup() { rm -f /tmp/batch1_body.$$; }
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
TEST_EMAIL="batch1-${TS}@levora.test"
TEST_PASS="Batch1Test!${TS}"
TOKEN=""

# ══════════════════════════════════════════════════════════════════
# Auth — register + login must return tokens only
# ══════════════════════════════════════════════════════════════════
section "Auth — token-only responses (DEC-AUTH-04)"

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
TOKEN=$(jq -r '.data.accessToken // empty' /tmp/batch1_body.$$)
if [[ -n "$TOKEN" ]]; then pass "login returned accessToken"
else fail "login did not return accessToken"; exit 1; fi

# ══════════════════════════════════════════════════════════════════
# Reference endpoints — public, no auth
# ══════════════════════════════════════════════════════════════════
section "Reference endpoints — public (no auth required)"

for path in countries cities marital-statuses education-levels app-languages; do
  code=$(http GET "$API/reference/$path")
  assert_status "200" "$code" "GET /reference/$path → 200 without token"
  assert_jq ".data | type" "array" "  response.data is an array"
done

# countries must expose nameEn / nameAr
http GET "$API/reference/countries" >/dev/null
assert_jq '.data[0] | has("nameEn")' "true" "reference country item has nameEn"
assert_jq '.data[0] | has("nameAr")' "true" "reference country item has nameAr"

# sort + order
code=$(http GET "$API/reference/countries?sort=nameAr&order=desc")
assert_status "200" "$code" "GET /reference/countries?sort=nameAr&order=desc → 200"

# tolerant behavior — fake query param allowed (Option B)
code=$(http GET "$API/reference/countries?fake_param=1")
assert_status "200" "$code" "GET /reference/countries?fake_param=1 → 200 (tolerant)"

code=$(http GET "$API/reference/languages?fake_param=1")
assert_status "200" "$code" "GET /reference/languages?fake_param=1 → 200 (tolerant)"

# capture a country + marital-status ID for later use
COUNTRY_ID=$(curl -s "$API/reference/countries" | jq -r '.data[0].id // empty')
MARITAL_ID=$(curl -s "$API/reference/marital-statuses" | jq -r '.data[0].id // empty')
EDU_LEVEL_ID=$(curl -s "$API/reference/education-levels" | jq -r '.data[0].id // empty')

# ══════════════════════════════════════════════════════════════════
# Profile — authentication required
# ══════════════════════════════════════════════════════════════════
section "Profile — auth enforcement"

code=$(http GET "$API/profile/me")
assert_status "401" "$code" "GET /profile/me without token → 401"

code=$(http PATCH "$API/profile/personal" \
  -H "Content-Type: application/json" -d '{"firstName":"X"}')
assert_status "401" "$code" "PATCH /profile/personal without token → 401"

# ══════════════════════════════════════════════════════════════════
# Profile — 8-section structure + initial state
# ══════════════════════════════════════════════════════════════════
section "Profile — GET /profile/me shape (EC-001, FR-001)"

code=$(http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN")
assert_status "200" "$code" "GET /profile/me with token → 200"
assert_jq ".data.completionPct" "0" "new profile starts with completionPct = 0"
assert_jq ".data.isMatchable" "false" "new profile isMatchable = false"
assert_jq ".data.matchingVersion | type" "number" "matchingVersion is a number"

for section_name in educations languages testResults specialStatuses \
                    targetDegrees targetMajors targetInstitutions documents; do
  assert_jq ".data.$section_name | type" "array" "  section '$section_name' is an array"
done

# ══════════════════════════════════════════════════════════════════
# Profile — field validation
# ══════════════════════════════════════════════════════════════════
section "Profile — DTO strictness (EC-003, FR-007, FR-012)"

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
assert_status "400" "$code" "PATCH with unknown field → 400 UNKNOWN_FIELD"

# ══════════════════════════════════════════════════════════════════
# Profile — bio boundary (EC-005)
# ══════════════════════════════════════════════════════════════════
section "Profile — bio boundary (EC-005)"

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

# ══════════════════════════════════════════════════════════════════
# Profile — experiences boundary (EC-011b / DEC-PROF-20)
# ══════════════════════════════════════════════════════════════════
section "Profile — experiences boundary (EC-011b)"

EXP10='["e1","e2","e3","e4","e5","e6","e7","e8","e9","e10"]'
EXP11='["e1","e2","e3","e4","e5","e6","e7","e8","e9","e10","e11"]'

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"experiences\":$EXP10}")
assert_status "200" "$code" "experiences = 10 entries → 200 (at limit)"
assert_jq ".data.experiences | length" "10" "  response reflects 10 entries"

code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"experiences\":$EXP11}")
assert_status "400" "$code" "experiences = 11 entries → 400 (over limit)"

LONG=$(printf 'a%.0s' {1..501})
code=$(http PATCH "$API/profile/personal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"experiences\":[\"$LONG\"]}")
assert_status "400" "$code" "single experience entry > 500 chars → 400"

# ══════════════════════════════════════════════════════════════════
# Profile — city / country consistency (EC-006)
# ══════════════════════════════════════════════════════════════════
section "Profile — city / country consistency (EC-006)"

if [[ -n "$COUNTRY_ID" ]]; then
  code=$(http PATCH "$API/profile/personal" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"currentCityId":"123e4567-e89b-12d3-a456-426614174000"}')
  assert_status "400" "$code" "city without country → 400"

  # set a valid country first
  http PATCH "$API/profile/personal" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"countryOfResidenceId\":\"$COUNTRY_ID\"}" >/dev/null

  # now send a fake city not belonging to that country
  code=$(http PATCH "$API/profile/personal" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"currentCityId":"123e4567-e89b-12d3-a456-426614174000"}')
  assert_status "400" "$code" "city not in selected country → 400"
else
  SKIP=$((SKIP+1))
  printf '  %s⊘%s city/country tests skipped (no reference countries)\n' "$YELLOW" "$RESET"
fi

# ══════════════════════════════════════════════════════════════════
# Profile — completion & matchingVersion
# ══════════════════════════════════════════════════════════════════
section "Profile — completion engine (EC-054, FR-005)"

# capture matchingVersion before
http GET "$API/profile/me" -H "Authorization: Bearer $TOKEN" >/dev/null
V_BEFORE=$(jq -r '.data.matchingVersion' /tmp/batch1_body.$$)

# fill every Batch 1 field
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
V_AFTER=$(jq -r '.data.matchingVersion' /tmp/batch1_body.$$)
PCT=$(jq -r '.data.completionPct' /tmp/batch1_body.$$)
MATCH=$(jq -r '.data.isMatchable' /tmp/batch1_body.$$)

if [[ "$V_AFTER" -gt "$V_BEFORE" ]]; then
  pass "matchingVersion incremented ($V_BEFORE → $V_AFTER)"
else
  fail "matchingVersion did not increment" "before=$V_BEFORE, after=$V_AFTER"
fi

# Batch 1 maximum reachable = 43 points (Personal 18 + Location 15 + edu level 10)
if [[ "$PCT" -eq 43 ]]; then
  pass "completionPct = 43 after all Batch 1 fields (Personal 18 + Location 15 + eduLevel 10)"
else
  fail "completionPct expected 43, got $PCT" \
       "Personal(18)+Location(15)+educationLevelId(10) should equal 43"
fi

if [[ "$MATCH" == "false" ]]; then
  pass "isMatchable = false (43 < threshold 60)"
else
  fail "isMatchable should be false at 43%" "got $MATCH"
fi

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

printf '\n  %sAll Batch 1 tests passed.%s\n' "$GREEN$BOLD" "$RESET"
exit 0
