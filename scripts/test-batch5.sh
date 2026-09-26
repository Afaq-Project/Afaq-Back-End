#!/bin/bash

# scripts/test-batch5.sh

set -e

API_URL="http://localhost:3000/api/v1"
EMAIL="batch5-user-$(date +%s)@example.com"
PASSWORD="Password1!"

echo "Registering user..."
curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"Batch\",\"lastName\":\"Five\"}" > /dev/null

echo "Logging in..."
LOGIN_RES=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RES | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi

echo "Got token."

# EC-035: Invalid special status -> 400
RES_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API_URL/profile/special-statuses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"specialStatusId\":\"00000000-0000-0000-0000-000000000000\"}")
if [ "$RES_CODE" -ne 400 ]; then
  echo "EC-035 Failed: Expected 400, got $RES_CODE"
  exit 1
fi
echo "EC-035 Passed"

# EC-037: Remove missing -> 404
RES_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $API_URL/profile/special-statuses/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer $TOKEN")
if [ "$RES_CODE" -ne 404 ]; then
  echo "EC-037 Failed: Expected 404, got $RES_CODE"
  exit 1
fi
echo "EC-037 Passed"

# EC-038: Invalid degree -> 400
RES_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API_URL/profile/preferences/degrees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"educationLevelId\":\"00000000-0000-0000-0000-000000000000\"}")
if [ "$RES_CODE" -ne 400 ]; then
  echo "EC-038 Failed: Expected 400, got $RES_CODE"
  exit 1
fi
echo "EC-038 Passed"

# EC-041: Remove missing -> 404
RES_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $API_URL/profile/preferences/degrees/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer $TOKEN")
if [ "$RES_CODE" -ne 404 ]; then
  echo "EC-041 Failed: Expected 404, got $RES_CODE"
  exit 1
fi
echo "EC-041 Passed"

echo "All Batch 5 endpoints tested successfully via Bash script!"
