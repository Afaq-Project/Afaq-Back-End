# Remediation Plan

## Phase Plan
*   **Phase 1: Security & Data Integrity (Critical-Path)**
    *   Fix the mass assignment vulnerability in `UpdateProfileDto` to prevent unauthorized field modifications.
    *   Fix GPA data loss caused by strict type-checking on stringified numbers.
    *   Fix the arbitrary overwrite of the oldest education record by targeting the newest record.
*   **Phase 2: API & Response Mapping (Sequential)**
    *   Update the DTO/Serializer for `GET /api/v1/profile` to expose and flatten the new `userFieldsOfStudy` taxonomy.
*   **Phase 3: Migration Scripts (Parallel Sidecar)**
    *   Delete `scripts/migrate-fields-of-study.ts` and `scripts/rollback-fields-of-study.ts` since the migration is already complete.
