# Area B: Postman Coverage Expansion Plan

## Ownership
**Domain/Area:** API Documentation
**Target Sub-Agent:** `oma-planner` / `oma-executor` (API Docs focus)

## Issue Identification
**Issue:** 10 profile sub-resource and reference endpoints are missing from the Postman definitions and smoke tests.
**Root Cause:** The recent architectural refactoring successfully migrated `skills`, `languages`, and `fieldOfStudy` from monolithic array fields on the `PATCH /profile` payload into their own dedicated RESTful CRUD endpoints. However, the Postman JSON definitions were never updated to reflect this new architectural paradigm, resulting in severe coverage gaps for QA.

## Dependency Mapping
- **Prerequisites:** None. This can be executed in parallel with Area A and Area C.
- **Dependents:** QA automation and frontend integration depend on accurate API definitions.

## Corrective Strategy
1. Add new request items for `Skills` (GET, POST, DELETE) to the Postman and smoke-test JSON files.
2. Add new request items for `Languages` (GET, POST, DELETE) to the JSON files.
3. Add new request items for `Fields of Study` (GET, POST, DELETE) to the JSON files.
4. Add the missing `GET /api/v1/reference/languages` endpoint.
5. Ensure valid authorization headers and payload structures are defined for each.
