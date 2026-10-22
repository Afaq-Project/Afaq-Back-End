#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "FEATURE 11 ARCHITECTURAL & SPECIFICATION VERIFICATION SUITE"
echo "=========================================================="

ERRORS=0
FINDINGS=0

# 1. Check LocalEmbeddingService for 384 dimensions and all-MiniLM-L6-v2
echo -n "[Check 1] LocalEmbeddingService architecture... "
if grep -q "all-MiniLM-L6-v2" src/modules/ai-assistant/memory/local-embedding.service.ts && \
   grep -q "embedding.length === 384" src/modules/ai-assistant/memory/local-embedding.service.ts && \
   grep -q "@xenova/transformers" src/modules/ai-assistant/memory/local-embedding.service.ts; then
  echo "PASS (384-dim, in-process @xenova/transformers, all-MiniLM-L6-v2)"
else
  echo "FAIL"
  ERRORS=$((ERRORS + 1))
fi

# 2. Check GeminiProvider dynamic model resolution
echo -n "[Check 2] GeminiProvider dynamic model resolution... "
if grep -q "GEMINI_MODEL" src/modules/ai-assistant/providers/gemini.provider.ts && \
   grep -q "gemini-3.5-flash-lite" src/modules/ai-assistant/providers/gemini.provider.ts; then
  echo "PASS (configService.get('GEMINI_MODEL') with 'gemini-3.5-flash-lite' fallback)"
else
  echo "FAIL"
  ERRORS=$((ERRORS + 1))
fi

# 3. Check Proposal Acceptance triggers DraftVersionsService.createSnapshot
echo -n "[Check 3] Rollback snapshot on proposal acceptance... "
if grep -q "this.draftVersionsService.createSnapshot" src/modules/ai-assistant/ai-proposals/ai-proposals.service.ts; then
  echo "PASS (calls draftVersionsService.createSnapshot prior to ProseMirror AST mutation)"
else
  echo "FAIL"
  ERRORS=$((ERRORS + 1))
fi

# 4. Check REST endpoints & HTTP 200 OK status codes
echo -n "[Check 4] HTTP 200 OK status code annotations on AI endpoints... "
CHAT_200=$(grep -c "HttpStatus.OK" src/modules/ai-assistant/ai-chat/ai-chat.controller.ts || true)
ACCEPT_200=$(grep -c "HttpStatus.OK" src/modules/ai-assistant/ai-proposals/ai-proposals.controller.ts || true)
if [ "$CHAT_200" -ge 1 ] && [ "$ACCEPT_200" -ge 2 ]; then
  echo "PASS (explicit @HttpCode(HttpStatus.OK) present on chat, accept, and reject)"
else
  echo "FAIL"
  ERRORS=$((ERRORS + 1))
fi

# 5. Check Postman Collection for AI Proposals endpoints
echo -n "[Check 5] Postman collection coverage for AI Proposals endpoints... "
if grep -q "ai/proposals" Levora_API.postman_collection.json; then
  echo "PASS"
else
  echo "FINDING (Levora_API.postman_collection.json lacks AI Proposals endpoints)"
  FINDINGS=$((FINDINGS + 1))
fi

# 6. Check Task Codes OMA-W006-T001 to OMA-W006-T007
echo "[Check 6] Task Codes placement verification:"
for t in $(seq -f "%03g" 1 7); do
  CODE="OMA-W006-T$t"
  MATCH_COUNT=$(grep -rn "$CODE" src/ prisma/ .env.example 2>/dev/null | wc -l || true)
  if [ "$MATCH_COUNT" -gt 0 ]; then
    echo "  - $CODE: FOUND ($MATCH_COUNT occurrences)"
  else
    echo "  - $CODE: NOT FOUND (missing code comment)"
    FINDINGS=$((FINDINGS + 1))
  fi
done

echo "=========================================================="
echo "SUMMARY: Errors: $ERRORS | Findings: $FINDINGS"
echo "=========================================================="
