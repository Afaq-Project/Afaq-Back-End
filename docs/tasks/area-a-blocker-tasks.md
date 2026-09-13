# Area A: Postman Blocker Resolution Tasks

**Owner:** `oma-debugger`

## TASK-A-001: Fix unquoted variable in Levora_API.postman_collection.json
- **Why it's necessary:** Fixes the JS crash blocking downstream document endpoints.
- **Action:** Open `Levora_API.postman_collection.json`, locate the document upload test script, and change `pm.collectionVariables.set(documentId, ...)` to `pm.collectionVariables.set("documentId", ...)`.
- **Prerequisites:** None.
- **Commit:** `fix(postman): add quotes to documentId variable setter`

## TASK-A-002: Fix unquoted variable in levora-smoke-tests.json
- **Why it's necessary:** Ensures automated smoke tests do not crash during CI/CD.
- **Action:** Open `tests/levora-smoke-tests.json`, locate the document upload test script, and apply the same variable quoting fix.
- **Prerequisites:** None.
- **Commit:** `fix(tests): add quotes to documentId variable in smoke tests`
