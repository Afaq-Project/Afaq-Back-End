# Area B: Postman Coverage Expansion Tasks

**Owner:** API Documentation Agent (`oma-executor`)

## TASK-B-001: Append Skills Endpoints to API Collections
- **Why it's necessary:** Eliminates regression blind spots for the newly decoupled skills taxonomy.
- **Action:** Add `GET`, `POST`, and `DELETE` endpoints for `/api/v1/profile/skills` to both `Levora_API.postman_collection.json` and `tests/levora-smoke-tests.json`.
- **Prerequisites:** None.
- **Commit:** `docs(api): append missing skills sub-resource endpoints`

## TASK-B-002: Append Languages & Fields of Study Endpoints
- **Why it's necessary:** Covers the remaining decoupled taxonomies and public references.
- **Action:** Add `GET`, `POST`, and `DELETE` endpoints for both `/api/v1/profile/languages` and `/api/v1/profile/fields-of-study`. Add `GET /api/v1/reference/languages`. Apply changes to both Postman and smoke-test files.
- **Prerequisites:** None.
- **Commit:** `docs(api): append missing languages and fields of study endpoints`
