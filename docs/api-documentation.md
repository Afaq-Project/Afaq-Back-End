# Levora Platform — Complete Frontend API Integration Guide

> **Document Version**: v2.0  
> **Target Audience**: Frontend Engineers (React, Next.js, Vue, Mobile / React Native / Flutter)  
> **Backend Architecture**: NestJS (Modular Architecture, RESTful JSON)  
> **Default Base URL**: `http://localhost:3000/api/v1` (Production / Staging: `https://<domain>/api/v1`)  
> **Global Prefix & Versioning**: `/api/v1`  
> **API Contract Reference**: [Postman Collection](file:///home/abood/Project/Afaq/Afaq-backend/Levora_API.postman_collection.json)

---

## 1. Global Architectural Standards & Response Envelopes

Every endpoint in Levora (across Auth, Users, Profile, Reference Data, Storage, and Health) adheres to consistent architectural principles.

### 1.1 Response Envelope Structure
All successful HTTP responses are wrapped in a standard JSON envelope:

```typescript
interface ApiResponse<T> {
  statusCode: number;      // HTTP Status code (200, 201, 204)
  message: string;         // Human-readable summary (e.g. "OK", "Created successfully")
  data: T;                 // Resource payload
  meta?: {
    pagination?: PaginationMeta;
    requestId?: string;    // Correlation ID echoed from request header or generated
    deprecation?: {
      message: string;
      sunsetDate: string;
      replacement: string;
    };
  };
  timestamp: string;       // ISO 8601 UTC timestamp (e.g. "2026-09-20T08:00:00.000Z")
}
```

### 1.2 Unified Pagination Structure
Endpoints returning lists use a unified pagination mechanism.

#### Standard Query Parameters
| Query Param | Type | Default | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Min: `1` | Current page number (1-indexed) |
| `limit` | `integer` | *Varies by endpoint* | Min: `1`, Max: `100` | Items per page |
| `search` | `string` | *Optional* | Max: `100` chars | Sanitised literal string search |

#### Standard Pagination Meta (`meta.pagination`)
```typescript
interface PaginationMeta {
  page: number;        // Current page number
  limit: number;       // Items requested per page
  total: number;       // Total records matching criteria
  totalPages: number;  // Total pages (ceil(total / limit))
  hasNext: boolean;    // true if page < totalPages
  hasPrev: boolean;    // true if page > 1
}
```

### 1.3 Error Envelope
When any request fails (validation, authentication, authorization, or server error), the server returns:

```typescript
interface ApiErrorResponse {
  statusCode: number;      // 400, 401, 403, 404, 409, 422, 429, 500
  message: string;         // High-level error description
  errors?: Array<{
    field: string;         // Property name that failed validation
    code: string;          // Machine-readable code (e.g. "VALIDATION_REQUIRED")
    message: string;       // Human-readable validation advice
  }>;
  timestamp: string;       // ISO 8601 UTC timestamp
}
```

---

## 2. Authentication, Token Lifecycle & Session Handling

Levora features a dual-mode authentication scheme: **Bearer Authorization header** and **Secure HttpOnly Cookies**.

```
                       ┌───────────────────────────────┐
                       │ Frontend / Client Application │
                       └───────────────┬───────────────┘
                                       │
        1. POST /auth/login (or OAuth) │
        ◄──────────────────────────────┼──────────────────────────────┐
        2. Returns { accessToken,      │                              │
           refreshToken, user }        │                              │
        + Sets cookies:                │                              │
          - access_token (15m, /)      │                              │
          - refresh_token (7d, /refresh│                              │
                                       ▼                              │
                       ┌───────────────────────────────┐              │
                       │ Authenticated Calls (/profile)│              │
                       │ Header: Bearer <accessToken>  │              │
                       └───────────────┬───────────────┘              │
                                       │                              │
                         401 Token Expired                            │
                                       │                              │
                                       ▼                              │
                       ┌───────────────────────────────┐              │
                       │ POST /auth/refresh            │              │
                       │ Cookie OR Body: {refreshToken}│──────────────┘
                       └───────────────────────────────┘
```

### 2.1 Storage & Usage in the Frontend
1. **Access Token**:
   - Short-lived (**15 minutes**).
   - Received in response body (`accessToken`) and as an HttpOnly cookie (`access_token`).
   - For SPA / mobile clients: Store in secure memory or secure storage (e.g. Expo SecureStore). Attach to API requests via header:
     ```http
     Authorization: Bearer <accessToken>
     ```
2. **Refresh Token**:
   - Long-lived (**7 days**).
   - Handled via HttpOnly cookie `refresh_token` (scoped to `/api/v1/auth/refresh`) or explicitly submitted in the request body `{ "refreshToken": "..." }`.
3. **Axios / Fetch Interceptor Recommended Pattern**:
   - Intercept outgoing requests to inject `Authorization: Bearer <accessToken>`.
   - Intercept incoming responses: on `401 Unauthorized`, queue pending requests, call `POST /auth/refresh`, update the access token, and retry the failed requests.

### 2.2 Security Policies & Guardrails
- **Whitelist Validation**: The server enforces `forbidNonWhitelisted: true`. Submitting any unexpected field in a JSON payload triggers a `400 Bad Request`.
- **UUID Validation**: Any route parameter specified as a UUID (e.g. `:userId`, `:skillId`, `:documentId`) is checked using `ParseUUIDPipe`. Invalid strings return `400` or `404` immediately.
- **CSRF & Origin**: OAuth and refresh routes enforce origin validation via `CsrfOriginGuard`.
- **Rate Limiting**:
  - `/auth/login`, `/auth/register`, `/auth/refresh`: **10 requests / 60 seconds** per IP.
  - `/reference/*`: **60 requests / 60 seconds** per IP.
  - Exceeding returns `429 Too Many Requests`.

---

## 3. Module: Authentication (`/auth`)

Public and authenticated routes for account creation, login, session refresh, OAuth, and current user identity.

### 3.1 Register User
- **Method**: `POST`
- **Path**: `/auth/register`
- **Auth**: Public (No token required)
- **Rate Limit**: 10 req/min

#### Request Payload
```json
{
  "email": "student@levora.org",
  "password": "StrongPassword123!",
  "firstName": "Sami",
  "lastName": "Husseini"
}
```
*Validation Rules*:
- `email`: Valid RFC email format.
- `password`: String, min 8 chars, max 128 chars. Must contain at least one letter and one number (`^(?=.*[A-Za-z])(?=.*\d).{8,}$`).
- `firstName`, `lastName`: Optional strings, max 100 chars.

#### Response `201 Created`
```json
{
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "id": "u1111111-1111-1111-1111-111111111111",
    "email": "student@levora.org",
    "name": "Sami Husseini",
    "role": "USER",
    "isEmailVerified": false,
    "createdAt": "2026-09-20T08:00:00.000Z",
    "updatedAt": "2026-09-20T08:00:00.000Z"
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 3.2 Login (Email & Password)
- **Method**: `POST`
- **Path**: `/auth/login`
- **Auth**: Public
- **Rate Limit**: 10 req/min

#### Request Payload
```json
{
  "email": "student@levora.org",
  "password": "StrongPassword123!"
}
```

#### Response `200 OK`
*Sets cookies `access_token` and `refresh_token`.*
```json
{
  "statusCode": 200,
  "message": "Login successful, returns access and refresh tokens",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "u1111111-1111-1111-1111-111111111111",
      "email": "student@levora.org",
      "name": "Sami Husseini",
      "role": "USER",
      "isEmailVerified": false,
      "createdAt": "2026-09-20T08:00:00.000Z",
      "updatedAt": "2026-09-20T08:00:00.000Z"
    }
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 3.3 Refresh Access Token
- **Method**: `POST`
- **Path**: `/auth/refresh`
- **Auth**: Public (Requires refresh token via Cookie or Body)

#### Request Payload (Optional if Cookie is sent)
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Tokens refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 3.4 Logout
Revokes the refresh token family, blacklists the access token in Redis, and clears cookies.

- **Method**: `POST`
- **Path**: `/auth/logout`
- **Auth**: Bearer Token
- **Response**: `204 No Content` (Empty payload)

---

### 3.5 Get Current User (Me)
- **Method**: `GET`
- **Path**: `/auth/me`
- **Auth**: Bearer Token

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "OK",
  "data": {
    "id": "u1111111-1111-1111-1111-111111111111",
    "email": "student@levora.org",
    "name": "Sami Husseini",
    "role": "USER",
    "isEmailVerified": false,
    "createdAt": "2026-09-20T08:00:00.000Z",
    "updatedAt": "2026-09-20T08:00:00.000Z"
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 3.6 Social OAuth (Google & LinkedIn)
The frontend initiates social authentication by redirecting the user browser directly to the initiation endpoint.

#### 1. Initiate OAuth
- **Google**: `GET /api/v1/auth/google`
- **LinkedIn**: `GET /api/v1/auth/linkedin`
- **Action**: The backend returns a `302 Found` redirecting the browser to Google/LinkedIn consent screens.

#### 2. Handle OAuth Callback
Upon consent, the provider redirects back to:
- `GET /api/v1/auth/google/callback?code=...`
- `GET /api/v1/auth/linkedin/callback?code=...`
- **Result**: The server processes user identity, creates an account if not existing, writes the token cookies, and responds with `LoginResponseDto` (`accessToken`, `refreshToken`, `user`).

---

## 4. Module: Reference Data (`/reference`)

Public lookup endpoints designed for form dropdowns, search-as-you-type inputs, and interface language settings.

| Endpoint | Method | Default Limit | Purpose in UI |
| :--- | :---: | :---: | :--- |
| `/reference/app-languages` | `GET` | Static (6) | Top navbar locale switcher |
| `/reference/education-levels` | `GET` | Static (7) | Standard education level dropdown |
| `/reference/languages` | `GET` | 20 | Language picker auto-complete |
| `/reference/fields-of-study` | `GET` | 20 | Field of study / major auto-complete |
| `/reference/skills-taxonomy` | `GET` | 50 (flat mode) | Skills categorization and search |

### 4.1 Get Application UI Languages
- **Method**: `GET`
- **Path**: `/reference/app-languages`
- **Auth**: Public

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "App languages retrieved successfully",
  "data": [
    { "code": "en", "name": "English", "nativeName": "English", "dir": "ltr" },
    { "code": "ar", "name": "Arabic", "nativeName": "العربية", "dir": "rtl" },
    { "code": "fr", "name": "French", "nativeName": "Français", "dir": "ltr" },
    { "code": "de", "name": "German", "nativeName": "Deutsch", "dir": "ltr" },
    { "code": "es", "name": "Spanish", "nativeName": "Español", "dir": "ltr" },
    { "code": "tr", "name": "Turkish", "nativeName": "Türkçe", "dir": "ltr" }
  ],
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 4.2 Get Education Levels
- **Method**: `GET`
- **Path**: `/reference/education-levels`
- **Auth**: Public

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Education levels retrieved successfully",
  "data": [
    { "id": "a0000000-0000-0000-0000-000000000003", "name": "bachelor", "labelEn": "Bachelor's Degree", "labelAr": "بكالوريوس", "isActive": true },
    { "id": "a0000000-0000-0000-0000-000000000006", "name": "certificate", "labelEn": "Certificate / Diploma Course", "labelAr": "شهادة مهنية", "isActive": true },
    { "id": "a0000000-0000-0000-0000-000000000002", "name": "diploma", "labelEn": "Associate Degree / Diploma", "labelAr": "دبلوم متوسط", "isActive": true },
    { "id": "a0000000-0000-0000-0000-000000000001", "name": "high_school", "labelEn": "High School", "labelAr": "ثانوية عامة", "isActive": true },
    { "id": "a0000000-0000-0000-0000-000000000004", "name": "master", "labelEn": "Master's Degree", "labelAr": "ماجستير", "isActive": true },
    { "id": "a0000000-0000-0000-0000-000000000007", "name": "other", "labelEn": "Other", "labelAr": "أخرى", "isActive": true },
    { "id": "a0000000-0000-0000-0000-000000000005", "name": "phd", "labelEn": "Doctorate / PhD", "labelAr": "دكتوراه", "isActive": true }
  ],
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 4.3 Get Master Languages (Paginated)
- **Method**: `GET`
- **Path**: `/reference/languages`
- **Query Params**: `page` (default 1), `limit` (default 20), `search` (e.g. `?search=eng`)

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Languages retrieved successfully",
  "data": [
    { "id": "11111111-1111-1111-1111-111111111111", "name": "Arabic" },
    { "id": "22222222-2222-2222-2222-222222222222", "name": "English" }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "total": 2, "totalPages": 1, "hasNext": false, "hasPrev": false }
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 4.4 Get Fields of Study (Paginated)
- **Method**: `GET`
- **Path**: `/reference/fields-of-study`
- **Query Params**: `page` (default 1), `limit` (default 20), `search` (e.g. `?search=comp`), `category` (e.g. `?category=Engineering`)

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Fields of study retrieved successfully",
  "data": [
    { "id": "c1111111-1111-1111-1111-111111111111", "name": "Computer Science", "category": "Engineering & Technology" }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false }
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 4.5 Get Skills Taxonomy (Dual-Mode)
- **Method**: `GET`
- **Path**: `/reference/skills-taxonomy`
- **Mode 1 (Grouped)**: Invoked with no parameters `GET /reference/skills-taxonomy` returns skills categorized in arrays with `meta.pagination: null`.
- **Mode 2 (Flat Search)**: Invoked with `search`, `category`, `page`, or `limit` returns a flat array with active `meta.pagination`.

#### Response `200 OK` (Grouped Mode)
```json
{
  "statusCode": 200,
  "message": "Skills taxonomy retrieved successfully",
  "data": [
    {
      "category": "Technology",
      "skills": [
        { "id": "s1111111-1111-1111-1111-111111111111", "name": "TypeScript" }
      ]
    }
  ],
  "meta": {
    "pagination": null
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

## 5. Module: User Profile (`/profile`)

The core applicant profile system with completion calculation and modular sub-resources.

### 5.1 Profile Completion Formula
The system returns `completionPct` (0–100) and `coreFieldsComplete` on profile requests:
- **Core Fields (40%)**:
  - `educationLevelId` (15%)
  - `fieldOfStudy` array with ≥1 item (15%)
  - `nationality` (10%)
- **Additional Fields (60% — 12 fields × 5% each)**:
  `fullName`, `dateOfBirth`, `currentCountry`, `currentCity`, `phone`, `experienceLevel`, `hasFinancialNeed`, `careerGoals (>20 chars)`, `skills (≥1)`, `languages (≥1)`, `documents (≥1)`, `profilePhotoUrl`.
- **Publishing Requirement**: `POST /profile/publish` requires `coreFieldsComplete: true`.

---

### 5.2 Get User Profile
- **Method**: `GET`
- **Path**: `/profile`
- **Auth**: Bearer Token

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "userId": "u1111111-1111-1111-1111-111111111111",
    "fullName": "Jane Doe",
    "dateOfBirth": "1998-04-20T00:00:00.000Z",
    "nationality": "Jordanian",
    "educationLevel": "a0000000-0000-0000-0000-000000000003",
    "fieldOfStudy": ["Computer Science"],
    "currentCountry": "Jordan",
    "currentCity": "Amman",
    "phone": "+962791234567",
    "experienceLevel": "Mid",
    "hasFinancialNeed": false,
    "careerGoals": "Looking for scholarship opportunities in Artificial Intelligence.",
    "profilePhotoUrl": "https://storage.levora.org/avatars/user.jpg",
    "completionPct": 85,
    "coreFieldsComplete": true,
    "lastCompletedStep": 2,
    "gpaNormalized4": 3.85,
    "skills": [
      { "skillId": "s1111111-1111-1111-1111-111111111111", "name": "TypeScript", "proficiency": 4 }
    ],
    "languages": [
      { "languageId": "22222222-2222-2222-2222-222222222222", "name": "English", "proficiency": "Fluent" }
    ],
    "educations": [
      {
        "id": "e1111111-1111-1111-1111-111111111111",
        "institution": "University of Jordan",
        "degree": "Bachelor of Science",
        "major": "Computer Science",
        "graduationYear": 2024,
        "gpaNormalized4": 3.85
      }
    ],
    "documents": [
      { "id": "d1111111-1111-1111-1111-111111111111", "docType": "resume", "displayName": "Jane_Resume.pdf" }
    ]
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 5.3 Update User Profile
- **Method**: `PATCH`
- **Path**: `/profile`
- **Auth**: Bearer Token

#### Request Payload
```json
{
  "fullName": "Jane Doe",
  "nationality": "Jordanian",
  "educationLevel": "bachelor",
  "fieldOfStudy": ["Computer Science"],
  "currentCountry": "Jordan",
  "currentCity": "Amman",
  "phone": "+962791234567",
  "experienceLevel": "Mid",
  "hasFinancialNeed": false,
  "careerGoals": "Looking for scholarship opportunities in Artificial Intelligence."
}
```
*Note: `educationLevel` accepts either the slug name (`bachelor`) or its UUID. Once set, core fields cannot be cleared with `null`.*

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Updated successfully",
  "data": {
    "userId": "u1111111-1111-1111-1111-111111111111",
    "completionPct": 85,
    "coreFieldsComplete": true,
    "updatedAt": "2026-09-20T08:15:00.000Z"
  },
  "timestamp": "2026-09-20T08:15:00.000Z"
}
```

---

### 5.4 Publish Profile
- **Method**: `POST`
- **Path**: `/profile/publish`
- **Auth**: Bearer Token
- **Payload**: None
- **Response `200 OK`**: `{ "statusCode": 200, "message": "Profile published successfully", "data": { "isPublished": true, "publishedAt": "2026-09-20T08:30:00.000Z" } }`
- **Error `409 Conflict`**: Returned if already published or if `coreFieldsComplete === false`.

---

### 5.5 Profile Sub-Resources Endpoints

#### A. Skills (`/profile/skills`)
| Action | Method | Path | Payload / Param | Response |
| :--- | :---: | :--- | :--- | :--- |
| **List Skills** | `GET` | `/profile/skills` | `?page=1&limit=10` | 200 + Paginated skills list |
| **Get Skill** | `GET` | `/profile/skills/:skillId` | `:skillId` (UUID) | 200 + Single skill detail |
| **Add Skill** | `POST` | `/profile/skills` | `{"skillId": "<UUID>", "proficiency": 4}` (1-5) | 201 + Created skill |
| **Update Skill**| `PATCH` | `/profile/skills/:skillId` | `{"proficiency": 5}` | 200 + Updated skill |
| **Delete Skill**| `DELETE`| `/profile/skills/:skillId` | `:skillId` (UUID) | 204 No Content |

#### B. Languages (`/profile/languages`)
| Action | Method | Path | Payload / Param | Response |
| :--- | :---: | :--- | :--- | :--- |
| **List Languages** | `GET` | `/profile/languages` | `?page=1&limit=10` | 200 + Paginated user languages |
| **Get Language** | `GET` | `/profile/languages/:languageId` | `:languageId` (UUID) | 200 + Language item |
| **Add Language** | `POST` | `/profile/languages` | `{"languageId": "<UUID>", "proficiency": "Fluent"}` | 201 + Created record |
| **Update Language**| `PATCH`| `/profile/languages/:languageId` | `{"proficiency": "Native"}` | 200 + Updated record |
| **Delete Language**| `DELETE`| `/profile/languages/:languageId` | `:languageId` (UUID) | 204 No Content |

#### C. Education Records (`/profile/educations`)
| Action | Method | Path | Payload / Param | Response |
| :--- | :---: | :--- | :--- | :--- |
| **List Educations** | `GET` | `/profile/educations` | `?page=1&limit=10` | 200 + Paginated educations |
| **Create Education**| `POST` | `/profile/educations` | `{"institution": "...", "degree": "...", "major": "...", "graduationYear": 2024}` | 201 + Created record |
| **Update Education**| `PATCH`| `/profile/educations/:id` | `{"graduationYear": 2025, "gpaValue": 3.8, "gpaScale": "4.0"}` | 200 + Updated record |
| **Delete Education**| `DELETE`| `/profile/educations/:id` | `:id` (UUID) | 204 No Content |

#### D. Documents (`/profile/documents`)
| Action | Method | Path | Content-Type & Payload | Description |
| :--- | :---: | :--- | :--- | :--- |
| **Upload Document** | `POST` | `/profile/documents` | `multipart/form-data`<br>`file`: Binary (Max 5MB: PDF, DOCX, PNG, JPG)<br>`docType`: `resume` \| `essay` \| `transcript` \| `recommendation_letter` \| `other` | Scans file magic number, encrypts, and stores. |
| **List Documents** | `GET` | `/profile/documents` | `?page=1&limit=10` | 200 + Paginated documents. (`storagePath` is securely stripped). |
| **Download URL** | `GET` | `/profile/documents/:id/download` | `:id` (UUID) | 200 + `{ "url": "...", "expiresAt": "..." }` (HMAC signed download link valid for 15 minutes). |
| **Delete Document** | `DELETE`| `/profile/documents/:id` | `:id` (UUID) | 204 No Content |

---

## 6. Module: Users Administration (`/users`)

Endpoints for administrative user governance and viewing own user account details.

| Role Permission | Description |
| :--- | :--- |
| **Authenticated User** | Access to `GET /users/profile` |
| **ADMIN / system_admin** | Full CRUD: `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` |
| **content_admin** | Read-only admin access: `GET /users`, `GET /users/:id` |

### 6.1 Get Own Account Profile
- **Method**: `GET`
- **Path**: `/users/profile`
- **Auth**: Bearer Token
- **Response `200 OK`**: Returns user entity with email, name, role, email verification status, and profile relation.

---

### 6.2 List All Users (Admin)
- **Method**: `GET`
- **Path**: `/users`
- **Auth**: Bearer Token (Roles: `system_admin`, `ADMIN`, `content_admin`)

#### Query Parameters
| Parameter | Type | Default | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Min: 1 | Page number |
| `limit` | `integer` | `20` | Max: 100 | Page limit |
| `search` | `string` | - | - | Search by user name or email |
| `role` | `string` | - | `USER`, `ADMIN` | Filter by user role |
| `sort` | `string` | `createdAt` | `createdAt`, `updatedAt`, `email`, `name`, `role` | Sort column |
| `order` | `string` | `desc` | `asc`, `desc` | Sort direction |

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "OK",
  "data": [
    {
      "id": "u1111111-1111-1111-1111-111111111111",
      "email": "student@levora.org",
      "name": "Sami Husseini",
      "role": "USER",
      "isEmailVerified": false,
      "createdAt": "2026-09-20T08:00:00.000Z",
      "updatedAt": "2026-09-20T08:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 6.3 Create User (Admin)
- **Method**: `POST`
- **Path**: `/users`
- **Auth**: Bearer Token (Roles: `system_admin`, `ADMIN`)

#### Request Payload
```json
{
  "email": "newuser@levora.org",
  "name": "Nour Salem"
}
```
- **Response `201 Created`**: Returns created user data. Triggers verification email flow with an initial null password.

---

### 6.4 Get User by ID (Admin)
- **Method**: `GET`
- **Path**: `/users/:id`
- **Auth**: Bearer Token (Roles: `system_admin`, `ADMIN`, `content_admin`)
- **Param**: `:id` (UUID)
- **Response `200 OK`**: User detail. Returns `404 Not Found` if user does not exist.

---

### 6.5 Update User (Admin)
- **Method**: `PATCH`
- **Path**: `/users/:id`
- **Auth**: Bearer Token (Roles: `system_admin`, `ADMIN`)
- **Payload**: `{ "name": "Updated Name", "email": "updated@levora.org" }`
- **Response `200 OK`**: Updated user object.

---

### 6.6 Delete User (Admin)
- **Method**: `DELETE`
- **Path**: `/users/:id`
- **Auth**: Bearer Token (Roles: `system_admin`, `ADMIN`)
- **Param**: `:id` (UUID)
- **Response**: `204 No Content`

---

## 7. Module: Storage & Files (`/local-storage`)

Internal secure gateway for accessing encrypted local files.

### 7.1 Download Encrypted File
- **Method**: `GET`
- **Path**: `/local-storage/:fileKey?token=<signedToken>`
- **Auth**: Public (Access controlled via URL query HMAC signature)
- **Query Param `token`**: Base64 encoded payload + SHA256 HMAC signature generated by `/profile/documents/:id/download`.
- **Response**: Decrypted binary file stream with original `Content-Type` header (e.g. `application/pdf`).
- **Errors**:
  - `400 Bad Request`: Token missing or HMAC signature invalid (timing-safe check).
  - `404 Not Found`: File not found on disk.

---

## 8. Module: Health Probes (`/health`)

Public probes for frontend status monitors, load balancers, and DevOps clusters.

### 8.1 Liveness Probe
- **Method**: `GET`
- **Path**: `/health`
- **Auth**: Public
- **Response `200 OK`**: `{ "status": "ok" }`

### 8.2 Readiness Probe
- **Method**: `GET`
- **Path**: `/health/ready`
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

---

## 9. Frontend Integration Blueprints & Best Practices

### 9.1 Recommended API Client Architecture (TypeScript)

```typescript
// src/services/apiClient.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  withCredentials: true, // Crucial for receiving and sending auth cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token from memory / store
apiClient.interceptors.request.use((config) => {
  const token = getInMemoryAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatic silent refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        setInMemoryAccessToken(data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        clearAuthSession();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);
```

### 9.2 UI State Machine for Profile Wizard
```
 [1. Fetch References]
 ├── GET /reference/app-languages    → Setup RTL / LTR layout
 ├── GET /reference/education-levels → Populate Education Level Select
 └── GET /reference/languages        → Populate Spoken Languages
            │
            ▼
 [2. Fetch Current State]
 └── GET /profile
     ├── Render Personal Info form
     ├── Display completionPct in Progress Bar
     └── Check coreFieldsComplete
            │
            ▼
 [3. Live Editing]
 ├── Debounced PATCH /profile on input change (saves draft)
 ├── POST /profile/skills, educations, languages
 └── POST /profile/documents (Multipart upload with progress)
            │
            ▼
 [4. Final Submission]
 └── If coreFieldsComplete === true:
     Enable "Publish Profile" Button → Trigger POST /profile/publish
```

### 9.3 Quick Checklist for UI Developers
- [ ] Set `withCredentials: true` in your HTTP client for cross-site cookie propagation.
- [ ] For text inputs that trigger searches (`/reference/languages`, `/reference/fields-of-study`, `/reference/skills-taxonomy`), implement a **300ms debounce**.
- [ ] Always check `meta.pagination.hasNext` before firing pagination requests in tables or infinite scroll lists.
- [ ] When uploading documents, validate file extensions client-side and limit file size to **5MB**.
- [ ] Direct file downloads must fetch the signed URL via `GET /profile/documents/:id/download` first, then open `data.url`.
