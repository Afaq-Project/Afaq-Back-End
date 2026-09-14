# Area A: Postman Blocker Resolution Plan

## Ownership
**Domain/Area:** API Test Debugging
**Target Sub-Agent:** `oma-debugger` (or equivalent QA-focused agent)

## Issue Identification
**Issue:** Document endpoints (Download and Delete) are blocked from execution in Postman and smoke tests.
**Root Cause:** A JavaScript syntax error exists in the "Test" script of the `POST /api/v1/profile/documents` request. Specifically, the command `pm.collectionVariables.set(documentId, ...)` uses an unquoted variable name (`documentId` instead of `"documentId"`), which triggers a runtime crash. Consequently, the ID is never saved to the environment, causing downstream requests to fail.

## Dependency Mapping
- **Prerequisites:** None.
- **Dependents:** Downstream document endpoints (`GET /download`, `DELETE`) rely on this fix to function.

## Corrective Strategy
1. Locate the test script for document uploads in both `Levora_API.postman_collection.json` and `tests/levora-smoke-tests.json`.
2. Wrap the variable key in quotes: `pm.collectionVariables.set("documentId", jsonData.data.id)`.
3. Verify JSON syntax integrity after modification.
