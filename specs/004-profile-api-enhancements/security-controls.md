# Security Controls: Profile API Enhancements (Feature 004)

## 1. Overview
This document outlines the security controls, threat vectors, and data flow analysis derived from the `004-profile-api-enhancements` specification. It defines the security requirements that must be implemented to ensure the safe processing of profile and reference data.

## 2. Data Flows and Authentication Points

### 2.1 Public Data Flows (Unauthenticated)
- **Endpoints**: `GET /reference/languages`, `GET /reference/education-levels`, `GET /reference/app-languages`, `GET /reference/fields-of-study`, `GET /reference/skills-taxonomy`.
- **Security Context**: These endpoints expose reference data. They do not require authentication, but must be protected against DoS attacks via unbounded queries or excessive resource consumption.

### 2.2 Authenticated Data Flows
- **Endpoints**: `PATCH /profile`, `GET /profile`, `GET /profile/skills`, `GET /profile/languages`, `GET /profile/documents`, `GET /profile/educations`.
- **Security Context**: These endpoints require authentication and handle user-specific personal data.

### 2.3 Authentication Data Flows
- **Endpoints**: `POST /auth/login`, `POST /auth/register`.
- **Security Context**: Highly sensitive endpoints vulnerable to brute force and credential stuffing attacks.

## 3. Threat Vectors & Vulnerabilities

1. **Denial of Service (DoS)**: 
   - Unbounded pagination limits or deep paging could exhaust database resources.
   - Long search strings could cause high CPU usage during text matching.
   - Repeated requests to authentication endpoints (brute force).
2. **Information Exposure**: 
   - Leaking internal server structures (e.g., `storagePath` for documents).
   - Passing malformed parameters (e.g., non-UUIDs) to the database layer resulting in verbose stack traces.
3. **Injection Attacks**: 
   - Search parameters parsed as SQL/NoSQL operators or executable code instead of literal strings.
4. **Mass Assignment**: 
   - Attackers injecting unexpected fields in request payloads to modify restricted database columns.

## 4. Security Controls

### SC-1: Pagination and Query Bounding
- **Description**: All list endpoints must enforce pagination with a strict maximum limit.
- **Implementation**: Enforce `limit` parameter to be an integer between 1 and 100. Reject invalid values with HTTP 400.
- **Traceability**: FR-004-13, SC-002, User Story 1 & 4.

### SC-2: Input Validation & Sanitization
- **Description**: All incoming data (query, path, and body parameters) must be strictly typed and validated.
- **Implementation**: 
  - Search queries must be treated as literal strings with a maximum length of 100 characters (FR-004-15).
  - Route parameters expecting UUIDs MUST be validated at the routing layer, rejecting non-UUIDs with HTTP 400 (FR-004-18, User Story 6, SC-005).
  - Enum validation for `educationLevel` to only accept standard values (FR-004-08).

### SC-3: Mass Assignment Prevention
- **Description**: The API must ignore or reject any fields not explicitly defined in the request Data Transfer Objects (DTOs).
- **Implementation**: Configure the global request validation (`ValidationPipe`) to use `forbidNonWhitelisted` mode, rejecting unknown fields with HTTP 400.
- **Traceability**: FR-004-20.

### SC-4: Authentication Rate Limiting
- **Description**: Authentication endpoints must limit repeated attempts to prevent brute force and credential stuffing.
- **Implementation**: Enforce a rate limit of exactly 5 requests per 60-second window per IP address on `POST /auth/login` and `POST /auth/register`. Return HTTP 429 Too Many Requests when exceeded.
- **Traceability**: FR-004-19, User Story 6, SC-006.

### SC-5: Sensitive Data Masking
- **Description**: Internal system paths and sensitive attributes must not be exposed to the client.
- **Implementation**: Explicitly exclude the `storagePath` field from the response of `GET /profile/documents`.
- **Traceability**: FR-004-11, User Story 4.

## 5. Specification Gaps & Ambiguities
- **Authorization Verification**: The specification mentions retrieving user-specific lists (e.g., `GET /profile/skills`), but does not explicitly state the authorization rule preventing users from accessing others' data (IDOR prevention). It relies on implied session context.
- **Rate Limiting on Reference Endpoints**: While authentication endpoints have strict rate limits, the unauthenticated reference data endpoints lack explicit rate limiting requirements (caching is explicitly deferred), which may expose them to scraping or DoS.
