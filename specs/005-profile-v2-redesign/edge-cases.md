# Edge Cases — Profile Module v2 Redesign

This is the acceptance edge-case inventory. Sources are limited to `spec.md`, `endpoints.md`, `data-model.md`, `decisions-log.md`, and `complete-schema.md`.

## Auth & Profile Core

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-001 | Signup creates profile | One empty profile keyed by account `userId`; `completionPct: 0`, `isMatchable: false`; no account/OAuth values copied | FR-001–002; DEC-AUTH-01–03 | ☐ |
| EC-002 | Partial personal update sends one valid field | Only submitted field changes; unrelated nullable fields retain their state; recalculation completes before response | FR-003–005; endpoints §1.2 | ☐ |
| EC-003 | Update sends `completionPct`, `isMatchable`, `matchingVersion`, `userId`, or timestamps | `400 UNKNOWN_FIELD`; computed fields are never client-controlled | FR-007, FR-012; endpoints §1.2 | ☐ |
| EC-004 | Profile identity differs from account identity | Profile name/email remains independent; no account synchronization occurs | FR-006; DEC-AUTH-01 | ☐ |
| EC-005 | `bio` is exactly configured maximum / one character over | At limit succeeds; over limit is `400 BIO_TOO_LONG` | FR-009b; endpoints §1.2 | ☐ |
| EC-006 | `currentCityId` belongs / does not belong to resolved residence country | Matching city succeeds; mismatch is `400 CITY_COUNTRY_MISMATCH`; changing country clears an incompatible existing city | endpoints §1.2 | ☐ |
| EC-007 | Invalid marital status, country, city, or education level UUID references | `400 INVALID_MARITAL_STATUS`, `INVALID_COUNTRY`, `INVALID_CITY`, or `INVALID_EDUCATION_LEVEL` respectively | endpoints §1.2 | ☐ |
| EC-008 | Invalid type, format, UUID, empty body, or undeclared DTO field | `400 VALIDATION_ERROR`; undeclared field is `400 UNKNOWN_FIELD` | endpoints §1.2; Constitution IV | ☐ |
| EC-009 | Missing, malformed, or expired Bearer token on protected profile route | `401 UNAUTHORIZED` and no profile data | endpoints §1; Constitution V | ☐ |
| EC-010 | Internal profile/storage/database failure | Uniform `500 INTERNAL_ERROR`, with no stack trace/internal details | endpoints cross-conventions; Constitution IV, IX | ☐ |
| EC-011 | Every nullable profile field is omitted, explicitly `null`, empty where type permits, then assigned a valid value | Omitted preserves value; `null` is represented/cleared according to optional DTO semantics; empty string is validated as its field type permits; valid value persists. Fields: `firstName`, `lastName`, `email`, `dateOfBirth`, `gender`, `maritalStatusId`, `phone`, `bio`, `profilePhotoUrl`, `countryOfResidenceId`, `nationalityId`, `currentCityId`, `educationLevelId`, `updatedAt` | data-model §UserProfiles; DEC-AUTH-02; endpoints §1.2 | ☐ |
| EC-011b | `experiences` is empty, at max, one over, or contains an entry over 500 chars | Empty → `[]`; at max → accepted; one over → `400 TOO_MANY_EXPERIENCES`; long entry → `400 VALIDATION_ERROR` | DEC-PROF-20 | ☐ |
| EC-012 | Settings table missing key or contains unparseable value | Fallback default is used; profile calculation does not fail | FR-010; DEC-PROF-05; T027 | ☐ |

## Education

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-013 | Create education with missing/nonexistent master FK | Missing DTO field is `400 VALIDATION_ERROR`; nonexistent level/institution/major/minor is `400 INVALID_EDUCATION_LEVEL`, `INVALID_INSTITUTION`, `INVALID_MAJOR`, or `INVALID_MINOR_MAJOR` | FR-014–015; endpoints §2 | ☐ |
| EC-014 | Create/update education with same `minorMajorId` and `majorId` | `400 MINOR_MAJOR_EQUALS_MAJOR` | FR-018b; endpoints §2 | ☐ |
| EC-015 | `endDate` before `startDate`; equal dates | Earlier is `400 INVALID_DATE_RANGE`; equal dates succeed | FR-018b; endpoints §2 | ☐ |
| EC-016 | `gpaRaw` supplied without `gpaScale`; scale/value combinations at 0 and maxima | Missing scale is `400 GPA_SCALE_REQUIRED`; 0 and each valid scale maximum normalize correctly | FR-016; endpoints §2; spec Edge Cases | ☐ |
| EC-017 | `isCurrent: true` with end date / `isCurrent: false` with expected graduation date | First persists `endDate: null`; second persists `expectedGraduationDate: null`, on create and update | FR-018b; endpoints §2 | ☐ |
| EC-018 | Optional education fields null vs empty vs valid value | Validate state for `minorMajorId`, `startDate`, `endDate`, `expectedGraduationDate`, `gpaRaw`, `gpaScale`, `gpaNormalized`, `updatedAt`; computed normalized GPA is not client-overridden | data-model §UserEducations; FR-016, FR-018b | ☐ |
| EC-019 | Duplicate `(userId, institutionId, majorId, educationLevelId)` | `409 EDUCATION_DUPLICATE`; database unique constraint prevents race duplicate | FR-017; data-model §UserEducations; endpoints §2 | ☐ |
| EC-020 | Education count exactly at / one above `MAX_EDUCATIONS` | At limit succeeds; next is `409 MAX_EDUCATIONS_REACHED` | FR-018; endpoints §2 | ☐ |
| EC-021 | Foreign/missing/invalid education ID for GET, PATCH, DELETE | Invalid UUID `400 VALIDATION_ERROR`; foreign or absent record `404 EDUCATION_NOT_FOUND` | endpoints §2 | ☐ |
| EC-022 | Delete only education record after education level exists | Record hard-deletes; only 25-point record contribution is removed; education-level 10 points remains; recalculates | spec Edge Cases; FR-004, FR-008 | ☐ |

## Languages

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-023 | Missing/nonexistent language or proficiency | `400 VALIDATION_ERROR`, `INVALID_LANGUAGE`, or `INVALID_PROFICIENCY_LEVEL` as applicable | FR-019–020; endpoints §3 | ☐ |
| EC-024 | Add same language twice for one user | `409 LANGUAGE_DUPLICATE`; composite PK remains unique | data-model §UserLanguages; endpoints §3 | ☐ |
| EC-025 | Language count exactly at / one above `MAX_LANGUAGES` | At limit succeeds; next is `409 MAX_LANGUAGES_REACHED` | FR-021; endpoints §3 | ☐ |
| EC-026 | Update attempts to alter `languageId`, or ID is foreign/missing | Undeclared `languageId` is `400 UNKNOWN_FIELD`; foreign/missing is `404 LANGUAGE_NOT_FOUND` | endpoints §3 | ☐ |
| EC-027 | `isNative` false/default then true, and preferred language/proficiency changes | Boolean persists and update recalculates; returned record includes master bilingual names | FR-019–020; T054 | ☐ |

## Standardized Tests

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-028 | Nonexistent test ID or missing/wrong score field | `400 INVALID_TEST` or `400 VALIDATION_ERROR` | FR-022–023; endpoints §4 | ☐ |
| EC-029 | Score equals min/max and score is just outside either bound | Boundaries succeed; outside is `400 SCORE_OUT_OF_RANGE` | FR-023; endpoints §4 | ☐ |
| EC-030 | Score aligns / does not align with configured score step | Aligned score succeeds; off-step is `400 SCORE_NOT_ALIGNED_TO_STEP` | FR-023; endpoints §4; T066 | ☐ |
| EC-031 | Optional `testDate` omitted, null/empty, valid date | Omitted/null handling follows DTO; invalid/empty date is `400 VALIDATION_ERROR`; valid date persists | data-model §UserTestResults; endpoints §4 | ☐ |
| EC-032 | Add same test type twice | `409 TEST_RESULT_DUPLICATE`; `(userId, testId)` stays unique | FR-024; data-model §UserTestResults; endpoints §4 | ☐ |
| EC-033 | Test count exactly at / one above `MAX_TEST_RESULTS` | At limit succeeds; next is `409 MAX_TEST_RESULTS_REACHED` | FR-025; endpoints §4 | ☐ |
| EC-034 | Foreign/missing/invalid test-result ID on GET/PATCH/DELETE | Invalid UUID `400 VALIDATION_ERROR`; foreign or absent is `404 TEST_RESULT_NOT_FOUND` | endpoints §4 | ☐ |

## Special Statuses & Preferences

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-035 | Add invalid special status | `400 INVALID_SPECIAL_STATUS` | FR-026; endpoints §5 | ☐ |
| EC-036 | Re-submit same special status | `200`, no error and exactly one pivot row (silent idempotency) | FR-027; endpoints §5 | ☐ |
| EC-037 | Remove foreign/missing/invalid special status | Invalid UUID `400 VALIDATION_ERROR`; foreign/missing is `404 SPECIAL_STATUS_NOT_FOUND` | endpoints §5 | ☐ |
| EC-038 | Add invalid target degree, major, or institution | `400 INVALID_EDUCATION_LEVEL`, `INVALID_MAJOR`, or `INVALID_INSTITUTION` | FR-028–030; endpoints §5 | ☐ |
| EC-039 | Re-submit same target degree, major, or institution | `200`, no error and no duplicate pivot row for each composite PK | FR-031; data-model §Pivot Tables; endpoints §5 | ☐ |
| EC-040 | Each preference category exactly at / one above its configured maximum | At limit succeeds; over is `409 MAX_TARGET_DEGREES_REACHED`, `MAX_TARGET_MAJORS_REACHED`, or `MAX_TARGET_INSTITUTIONS_REACHED` | FR-032; endpoints §5 | ☐ |
| EC-041 | Remove foreign/missing/invalid preference item | Invalid UUID `400 VALIDATION_ERROR`; missing/foreign yields `404 TARGET_DEGREE_NOT_FOUND`, `TARGET_MAJOR_NOT_FOUND`, or `TARGET_INSTITUTION_NOT_FOUND` | endpoints §5 | ☐ |
| EC-042 | Profile deletion after pivot rows exist | Profile deletion cascades statuses and all target preferences; no pivot rows survive | data-model §Pivot Tables | ☐ |

## Documents

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---:|
| EC-043 | Upload lacks file, uses undeclared multipart field, or invalid document type | `400 FILE_MISSING`, `UNKNOWN_FIELD`, or `INVALID_DOCUMENT_TYPE` | FR-033; endpoints §6 | ☐ |
| EC-044 | File size exactly at / one byte above configured maximum | At limit succeeds; over is `400 FILE_TOO_LARGE` | FR-033b; endpoints §6 | ☐ |
| EC-045 | MIME is allowed / not allowed | Allowed MIME proceeds; rejected MIME is `400 INVALID_MIME_TYPE` | FR-033b; endpoints §6 | ☐ |
| EC-046 | Declared document type differs from inspected content | `400 DOCUMENT_TYPE_MISMATCH`; file is not accepted | FR-033c; endpoints §6 | ☐ |
| EC-046b | Storage upload succeeds but document record creation fails | Attempt storage cleanup immediately, return an error, and leave no orphaned file | FR-033d; endpoints §6 | ☐ |
| EC-047 | Count exactly at / one above `MAX_DOCUMENTS` | At limit succeeds; next is `409 MAX_DOCUMENTS_REACHED` | endpoints §6 | ☐ |
| EC-048 | Foreign/missing/invalid document ID for download/delete | Invalid UUID `400 VALIDATION_ERROR`; foreign or missing `404 DOCUMENT_NOT_FOUND` | endpoints §6 | ☐ |
| EC-049 | Download URL request | Owner receives newly generated URL with `expiresIn: 900`; URL is not stored | FR-036; endpoints §6 | ☐ |
| EC-050 | Storage delete fails | `500 STORAGE_DELETE_FAILED`; DB record remains for retry | FR-034; DEC-PROF-09; endpoints §6 | ☐ |
| EC-051 | Storage delete succeeds but DB delete fails | Never report successful deletion; verify no orphan-file outcome and surface `500 INTERNAL_ERROR` for unexpected persistence failure | DEC-PROF-09; endpoints §6 | ☐ |
| EC-052 | Storage and DB deletion succeed | File and record are permanently hard-deleted; `204`; no soft-delete state | FR-035; DEC-PROF-10; endpoints §6 | ☐ |
| EC-053 | Profile/account deletion with documents and sub-records | Profile FK cascade deletes DB dependents; document deletion behavior remains storage-first for API deletion (cascade has no contradictory API rule) | data-model entity overview; DEC-PROF-09 | ☐ |

## Completion & Matchability

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---:|
| EC-054 | Empty profile | `completionPct: 0`, `isMatchable: false` | FR-008, FR-011; DEC-AUTH-03; T028 | ☐ |
| EC-055 | Exactly configured threshold (default 60) reached | `isMatchable` transitions false → true synchronously | FR-004, FR-011; DEC-PROF-01 | ☐ |
| EC-056 | Previously matchable profile drops below threshold after mutation | `isMatchable` transitions true → false synchronously | FR-011–012; spec US8 | ☐ |
| EC-057 | All six weighted groups are filled | `completionPct: 100`; `isMatchable: true` | FR-008; endpoints Batch 5 gate | ☐ |
| EC-058 | Update excluded fields or add second record in filled group | Completion unchanged, but every non-document mutation increments `matchingVersion` | FR-005, FR-009; DEC-PROF-03–04 | ☐ |
| EC-059 | Upload/delete document | No recalculation; `completionPct`, `isMatchable`, and `matchingVersion` unchanged | FR-009; endpoints §6 | ☐ |

## Cross-cutting

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---:|
| EC-060 | Reference endpoint requested without token | Every listed `/reference/*` endpoint is `200`, including empty city result `[]`; only active master data is returned where specified | FR-037–039; DEC-PROF-16; endpoints | ☐ |
| EC-061 | Country, major, institution search/filter/pagination inputs valid or invalid | Valid no-filter request is paginated; invalid query values are `400 VALIDATION_ERROR` | FR-040; spec Edge Cases; endpoints §§1–2 | ☐ |
| EC-062 | Profile is deleted | `UserProfiles` and education-related dependent rows cascade according to schema; uniqueness can be reused only after deletion | data-model §Entity Overview, §UserProfiles, §Pivot Tables | ☐ |
| EC-063 | Auth response/JWT is inspected | Auth response contains tokens only; JWT contains only stable account fields and no profile snapshot | DEC-AUTH-04–05; T030 | ☐ |
| EC-064 | Request/response error envelopes | Success/error use the documented envelope; error does not expose raw Prisma data or stack trace | endpoints cross-conventions; Constitution IV, IX | ☐ |
