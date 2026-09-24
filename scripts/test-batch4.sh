#!/bin/bash
set -e

# Start the app in the background
npm run start &
SERVER_PID=$!

echo "Waiting for server to start..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s http://localhost:3000/api/v1/reference/standardized-tests > /dev/null; then
    echo "Server is up!"
    break
  fi
  echo "Server not ready yet, retrying in 1 second..."
  sleep 1
  RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "Server failed to start in time."
  kill $SERVER_PID
  exit 1
fi

BASE_URL="http://localhost:3000/api/v1"

# Generate random email
RANDOM_STR=$(tr -dc a-z0-9 </dev/urandom | head -c 8 || true)
EMAIL="test_${RANDOM_STR}@example.com"
PASSWORD="Password123!"

echo "1. Registering test user..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\", \"firstName\":\"Test\", \"lastName\":\"User\"}" > /dev/null

echo "2. Logging in..."
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESP | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to get token!"
  kill $SERVER_PID
  exit 1
fi

echo "3. Fetching standardized tests... (/reference/standardized-tests)"
REF_RESP=$(curl -s -X GET "$BASE_URL/reference/standardized-tests" -H "Authorization: Bearer $TOKEN")

IELTS_ID=$(echo "$REF_RESP" | jq -r 'if .data then .data else . end | .[] | select(.nameEn == "IELTS") | .id')
SAT_ID=$(echo "$REF_RESP" | jq -r 'if .data then .data else . end | .[] | select(.nameEn == "SAT") | .id')

if [ -n "$IELTS_ID" ]; then
  echo "--- IELTS TESTS ---"
  
  echo "Testing IELTS Score 7.3 (Invalid Step) -> SCORE_NOT_ALIGNED_TO_STEP"
  IELTS_INV_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/profile/test-results" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"testId\":\"$IELTS_ID\", \"score\":7.3}")
  
  HTTP_STATUS_INV=$(echo "$IELTS_INV_RESP" | tail -n1)
  BODY_INV=$(echo "$IELTS_INV_RESP" | sed '$d')
  
  if [ "$HTTP_STATUS_INV" != "400" ]; then
    echo "Expected 400 for IELTS 7.3, got $HTTP_STATUS_INV"
  fi
  if ! echo "$BODY_INV" | grep -q "SCORE_NOT_ALIGNED_TO_STEP"; then
    echo "Expected SCORE_NOT_ALIGNED_TO_STEP in response, got: $BODY_INV"
  fi

  echo "Testing IELTS Score 7.5 (Valid) -> EC-031"
  IELTS_VAL_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/profile/test-results" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"testId\":\"$IELTS_ID\", \"score\":7.5}")
  
  HTTP_STATUS_VAL=$(echo "$IELTS_VAL_RESP" | tail -n1)
  BODY_VAL=$(echo "$IELTS_VAL_RESP" | sed '$d')
  
  if [ "$HTTP_STATUS_VAL" != "201" ]; then
    echo "Expected 201 for IELTS 7.5, got $HTTP_STATUS_VAL"
  fi
  
  RESULT_ID=$(echo "$BODY_VAL" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)

  if [ -n "$RESULT_ID" ]; then
    echo "Create test result (Duplicate) -> EC-032"
    DUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/profile/test-results" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"testId\":\"$IELTS_ID\", \"score\":7.5}")
    
    HTTP_STATUS_DUP=$(echo "$DUP_RESP" | tail -n1)
    if [ "$HTTP_STATUS_DUP" != "409" ]; then
      echo "Expected 409, got $HTTP_STATUS_DUP"
    fi

    echo "Update test result (Out of bounds) -> EC-033"
    UPD_RESP=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/profile/test-results/$RESULT_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"score\": 999.0}")
      
    HTTP_STATUS_UPD=$(echo "$UPD_RESP" | tail -n1)
    if [ "$HTTP_STATUS_UPD" != "400" ]; then
      echo "Expected 400 for update out of bounds, got $HTTP_STATUS_UPD"
    fi

    echo "Delete test result -> EC-034"
    DEL_RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/profile/test-results/$RESULT_ID" \
      -H "Authorization: Bearer $TOKEN")
      
    HTTP_STATUS_DEL=$(echo "$DEL_RESP" | tail -n1)
    if [ "$HTTP_STATUS_DEL" != "204" ]; then
      echo "Expected 204 for delete, got $HTTP_STATUS_DEL"
    fi
  fi
fi

if [ -n "$SAT_ID" ]; then
  echo "--- SAT TESTS ---"
  
  echo "Testing SAT Score 405 (Invalid Step) -> SCORE_NOT_ALIGNED_TO_STEP"
  SAT_INV_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/profile/test-results" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"testId\":\"$SAT_ID\", \"score\":405}")
  
  HTTP_STATUS_INV=$(echo "$SAT_INV_RESP" | tail -n1)
  BODY_INV=$(echo "$SAT_INV_RESP" | sed '$d')
  
  if [ "$HTTP_STATUS_INV" != "400" ]; then
    echo "Expected 400 for SAT 405, got $HTTP_STATUS_INV"
  fi
  if ! echo "$BODY_INV" | grep -q "SCORE_NOT_ALIGNED_TO_STEP"; then
    echo "Expected SCORE_NOT_ALIGNED_TO_STEP in response, got: $BODY_INV"
  fi

  echo "Testing SAT Score 410 (Valid)"
  SAT_VAL_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/profile/test-results" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"testId\":\"$SAT_ID\", \"score\":410}")
  
  HTTP_STATUS_VAL=$(echo "$SAT_VAL_RESP" | tail -n1)
  if [ "$HTTP_STATUS_VAL" != "201" ]; then
    echo "Expected 201 for SAT 410, got $HTTP_STATUS_VAL"
  fi
fi

echo "Testing invalid testId -> EC-028"
INV_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/profile/test-results" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"testId\":\"00000000-0000-0000-0000-000000000000\", \"score\": 5.0}")

HTTP_STATUS_INV=$(echo "$INV_RESP" | tail -n1)
if [ "$HTTP_STATUS_INV" != "404" ]; then
  echo "Expected 404 for invalid testId, got $HTTP_STATUS_INV"
fi

kill $SERVER_PID
echo "Done"
exit 0
