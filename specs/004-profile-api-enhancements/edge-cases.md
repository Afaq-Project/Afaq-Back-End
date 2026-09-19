# Edge Cases & Boundary Conditions: Feature 004

This document outlines all identified edge cases, corner cases, and boundary condition failures for the Profile API Enhancements feature (004). All cases trace back to specific functional requirements.

## 1. Pagination & Filtering Boundary Conditions
**Requirements TRACE: FR-004-13, FR-004-15**

*   **`page` or `limit` is exactly 0**: System MUST reject with 400 Bad Request. (Boundary failure)
*   **`page` or `limit` is a negative number**: System MUST reject with 400 Bad Request.
*   **`page` or `limit` is a decimal (e.g., 1.5)**: System MUST reject with 400 Bad Request.
*   **`limit` exceeds the maximum allowed (e.g., 101)**: System MUST reject with 400 Bad Request.
*   **`page` is very large (e.g., beyond total pages)**: System MUST return a valid paginated response with an empty data array and `hasNext: false`.
*   **`search` parameter contains SQL wildcards or HTML (`%`, `_`, `<script>`)**: System MUST treat input as a literal string (no SQL injection or XSS execution).
*   **`search` string is exactly 100 characters**: System MUST process the query normally (Upper boundary).
*   **`search` string is 101 characters**: System MUST reject with 400 Bad Request. (Boundary failure)
*   **Query parameter matches no records (e.g., skills-taxonomy search)**: System MUST return an empty paginated list (HTTP 200), not a 404 Not Found error.
*   **Unknown query parameters are provided (e.g., `?foo=bar`)**: System MUST silently ignore them and process the request normally.

## 2. Validation & Security Edge Cases
**Requirements TRACE: FR-004-08, FR-004-11, FR-004-18, FR-004-19, FR-004-20**

*   **Non-UUID route parameter provided (e.g., `/profile/skills/abc`)**: System MUST reject at routing layer with 400 Bad Request before database interaction.
*   **Invalid `educationLevel` string provided (e.g., `high_honors`)**: System MUST reject with 400 Bad Request (Enum validation failure).
*   **Education level case-sensitivity (e.g., `Bachelor` instead of `bachelor`)**: System MUST reject or normalize appropriately (typically reject for strict enum validation).
*   **Extra (non-whitelisted) fields sent in POST/PATCH payload**: System MUST reject with 400 Bad Request (`forbidNonWhitelisted` enforcement).
*   **`GET /profile/documents` response structure**: System MUST NOT expose the `storagePath` property even if the database record contains it (Data leak prevention).
*   **Rate limit threshold reached (6th request within 60s for auth endpoints)**: System MUST return 429 Too Many Requests on the 6th attempt, while the first 5 must succeed or fail with standard codes.

## 3. Profile Completion Calculations
**Requirements TRACE: FR-004-16, FR-004-17**

*   **New user with completely empty profile**: `completionPct` MUST be 0.
*   **Profile with only core weighted fields (Education 15%, Nationality 15%, Field of Study 15%)**: `completionPct` MUST be calculated accurately based on the new weights.
*   **Profile with all weighted fields filled**: `completionPct` MUST be exactly 100.

## 4. `skills-taxonomy` Dual-Mode Edge Cases
**Requirements TRACE: FR-004-05**

*   **No query parameters sent**: Response MUST be the legacy grouped structure.
*   **Only `page` and `limit` sent without `search`**: Response MUST switch to the flat paginated structure.
*   **Only `search` sent without pagination parameters**: Response MUST switch to the flat paginated structure using default pagination.

## Gaps & Ambiguities Identified
*   **Case Sensitivity for Enums:** The spec requires `educationLevel` validation against strings like "bachelor". It does not specify if the input is strictly case-sensitive. It's assumed strict based on validation standard defaults.
*   **Default `limit` for `skills-taxonomy`:** The spec mentions "default varies by endpoint" but does not explicitly state the default limits for the new flat `skills-taxonomy` mode or reference endpoints.
*   **Missing Pagination Metadata in Legacy Mode:** It's unclear if the legacy grouped response for `skills-taxonomy` will now contain `meta.pagination` or retain its exact previous shape.
