#!/bin/bash
# test-batch3.sh
# Functional endpoint verification script for Language CRUD (Batch 3)

set -e

BASE_URL="http://localhost:3000/api/v1"

# Helper to execute curl and parse HTTP status and body
request() {
  local METHOD=$1
  local URL=$2
  local DATA=$3
  local TOKEN=$4

  if [ -n "$TOKEN" ] && [ -n "$DATA" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X $METHOD -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$DATA" "$URL")
  elif [ -n "$TOKEN" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X $METHOD -H "Authorization: Bearer $TOKEN" "$URL")
  elif [ -n "$DATA" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X $METHOD -H "Content-Type: application/json" -d "$DATA" "$URL")
  else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X $METHOD "$URL")
  fi

  HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
}

assert_status() {
  local EXPECTED=$1
  local MSG=$2
  if [ "$HTTP_STATUS" -ne "$EXPECTED" ]; then
    echo "FAIL: $MSG - Expected status $EXPECTED, got $HTTP_STATUS. Body: $BODY"
    EXIT_CODE=1
  else
    echo "PASS: $MSG - Status $HTTP_STATUS"
  fi
}

assert_error_code() {
  local EXPECTED=$1
  local MSG=$2
  local ERROR_CODE=$(echo "$BODY" | grep -o '"code":"[^"]*"' | head -n1 | cut -d'"' -f4)
  if [ "$ERROR_CODE" != "$EXPECTED" ]; then
    echo "FAIL: $MSG - Expected error code $EXPECTED, got $ERROR_CODE. Body: $BODY"
    EXIT_CODE=1
  else
    echo "PASS: $MSG - Error code $EXPECTED"
  fi
}

EXIT_CODE=0

echo "Registering test user..."
EMAIL="test.batch3.$RANDOM@example.com"
request POST "$BASE_URL/auth/register" "{\"email\":\"$EMAIL\",\"password\":\"Pass123!\",\"firstName\":\"Test\",\"lastName\":\"User\"}"
USER_TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$USER_TOKEN" ]; then
  echo "FAIL: Failed to get user token. Body: $BODY"
  exit 1
fi

echo "Fetching reference data..."
request GET "$BASE_URL/reference/languages"
assert_status 200 "GET /reference/languages without auth"
LANG1_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
LANG2_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4)

request GET "$BASE_URL/reference/proficiency-levels"
assert_status 200 "GET /reference/proficiency-levels without auth"
PROF1_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
PROF2_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4)

if [ -z "$PROF1_ID" ]; then
  echo "WARN: Endpoint failed. Fetching PROF1_ID directly from DB to allow further testing..."
  cat > get-prof.js << 'JS'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.proficiencyLevels.findMany({ take: 2 });
  if(p.length > 0) {
    console.log(p[0].id);
    if(p[1]) console.log(p[1].id);
  }
}
main().then(()=>process.exit(0));
JS
  PROF_IDS=$(node get-prof.js)
  PROF1_ID=$(echo "$PROF_IDS" | head -n1)
  PROF2_ID=$(echo "$PROF_IDS" | sed -n '2p')
  rm get-prof.js
fi

if [ -z "$LANG1_ID" ]; then
  echo "FAIL: Failed to fetch reference data."
  exit 1
fi

echo "Running assertions..."

# 1. Missing languageId or proficiencyLevelId in POST -> 400 VALIDATION_ERROR
request POST "$BASE_URL/profile/languages" "{}" "$USER_TOKEN"
assert_status 400 "Missing fields in POST"
assert_error_code "VALIDATION_ERROR" "Missing fields in POST error code"

# 2. Nonexistent languageId UUID -> 400 INVALID_LANGUAGE
INVALID_UUID="00000000-0000-0000-0000-000000000000"
request POST "$BASE_URL/profile/languages" "{\"languageId\":\"$INVALID_UUID\",\"proficiencyLevelId\":\"$PROF1_ID\"}" "$USER_TOKEN"
assert_status 400 "Nonexistent languageId"
assert_error_code "INVALID_LANGUAGE" "Nonexistent languageId error code"

# 3. Nonexistent proficiencyLevelId UUID -> 400 INVALID_PROFICIENCY_LEVEL
request POST "$BASE_URL/profile/languages" "{\"languageId\":\"$LANG1_ID\",\"proficiencyLevelId\":\"$INVALID_UUID\"}" "$USER_TOKEN"
assert_status 400 "Nonexistent proficiencyLevelId"
assert_error_code "INVALID_PROFICIENCY_LEVEL" "Nonexistent proficiencyLevelId error code"

# Create valid language for further tests
request POST "$BASE_URL/profile/languages" "{\"languageId\":\"$LANG1_ID\",\"proficiencyLevelId\":\"$PROF1_ID\",\"isNative\":false}" "$USER_TOKEN"
assert_status 201 "Create valid language"

# 4. Adding the same (userId, languageId) twice -> 409 LANGUAGE_DUPLICATE
request POST "$BASE_URL/profile/languages" "{\"languageId\":\"$LANG1_ID\",\"proficiencyLevelId\":\"$PROF1_ID\"}" "$USER_TOKEN"
assert_status 409 "Duplicate language"
assert_error_code "LANGUAGE_DUPLICATE" "Duplicate language error code"

# 5. Adding beyond MAX_LANGUAGES -> 409 MAX_LANGUAGES_REACHED
# We'll just add as many as possible until failure, up to 15
for i in {2..11}; do
  LANG_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | sed -n "${i}p" | cut -d'"' -f4)
  if [ -n "$LANG_ID" ]; then
    # We will try to add, if it hits 409 we check code.
    request POST "$BASE_URL/profile/languages" "{\"languageId\":\"$LANG_ID\",\"proficiencyLevelId\":\"$PROF1_ID\"}" "$USER_TOKEN"
    if [ "$HTTP_STATUS" -eq 409 ]; then
      assert_error_code "MAX_LANGUAGES_REACHED" "Max languages reached error code"
      break
    fi
  fi
done

# 6. PATCH with languageId in the body -> 400 UNKNOWN_FIELD
request PATCH "$BASE_URL/profile/languages/$LANG1_ID" "{\"languageId\":\"$LANG2_ID\"}" "$USER_TOKEN"
assert_status 400 "PATCH with languageId"
assert_error_code "UNKNOWN_FIELD" "PATCH with languageId error code"

# 7. GET/PATCH/DELETE with a foreign record ID -> 404 LANGUAGE_NOT_FOUND
request GET "$BASE_URL/profile/languages/$INVALID_UUID" "" "$USER_TOKEN"
assert_status 404 "GET foreign record ID"
assert_error_code "LANGUAGE_NOT_FOUND" "GET foreign record ID error code"

request PATCH "$BASE_URL/profile/languages/$INVALID_UUID" "{\"isNative\":true}" "$USER_TOKEN"
assert_status 404 "PATCH foreign record ID"
assert_error_code "LANGUAGE_NOT_FOUND" "PATCH foreign record ID error code"

request DELETE "$BASE_URL/profile/languages/$INVALID_UUID" "" "$USER_TOKEN"
assert_status 404 "DELETE foreign record ID"
assert_error_code "LANGUAGE_NOT_FOUND" "DELETE foreign record ID error code"

# 8. PATCH with a valid proficiencyLevelId -> 200 OK and correct reflection in GET
request PATCH "$BASE_URL/profile/languages/$LANG1_ID" "{\"proficiencyLevelId\":\"$PROF2_ID\"}" "$USER_TOKEN"
assert_status 200 "PATCH valid proficiencyLevelId"

request GET "$BASE_URL/profile/languages/$LANG1_ID" "" "$USER_TOKEN"
assert_status 200 "GET valid language after PATCH"
# Verify it has PROF2_ID
if echo "$BODY" | grep -q "$PROF2_ID"; then
  echo "PASS: proficiencyLevelId reflects in GET"
else
  echo "FAIL: proficiencyLevelId does NOT reflect in GET. Body: $BODY"
  EXIT_CODE=1
fi

# 9. isNative false->true and true->false via PATCH -> Boolean persists correctly
request PATCH "$BASE_URL/profile/languages/$LANG1_ID" "{\"isNative\":true}" "$USER_TOKEN"
assert_status 200 "PATCH isNative:true"
request GET "$BASE_URL/profile/languages/$LANG1_ID" "" "$USER_TOKEN"
if echo "$BODY" | grep -q '"isNative":true'; then
  echo "PASS: isNative toggled to true"
else
  echo "FAIL: isNative did not toggle to true. Body: $BODY"
  EXIT_CODE=1
fi

request PATCH "$BASE_URL/profile/languages/$LANG1_ID" "{\"isNative\":false}" "$USER_TOKEN"
assert_status 200 "PATCH isNative:false"
request GET "$BASE_URL/profile/languages/$LANG1_ID" "" "$USER_TOKEN"
if echo "$BODY" | grep -q '"isNative":false'; then
  echo "PASS: isNative toggled to false"
else
  echo "FAIL: isNative did not toggle to false. Body: $BODY"
  EXIT_CODE=1
fi

exit $EXIT_CODE
