# Levora Profile & Reference API Documentation

> **Audience**: Frontend Developers (Web & Mobile)  
> **Version**: v1.0 (Feature Branch: `004-profile-api-enhancements`)  
> **Base URL**: `http://localhost:3000/api/v1` (or your configured environment base URL)  
> **Protocol**: HTTPS / RESTful JSON  
> **Authentication**: Bearer JWT (`Authorization: Bearer <accessToken>`)

---

## 1. Overview & Architecture Standards

This document provides a comprehensive integration guide for the **User Profile** and **Reference Data** APIs within the Levora platform.

### Standard Response Structure
All API responses follow Levora's standard REST envelope:

```typescript
interface ApiResponse<T> {
  statusCode: number;      // Standard HTTP status code (200, 201, etc.)
  message: string;         // Human-readable message describing result
  data: T;                 // Payload data (object or array)
  meta?: {                 // Optional metadata (pagination, deprecation, etc.)
    pagination?: PaginationMeta;
    requestId?: string;
  };
  timestamp: string;       // ISO 8601 UTC timestamp
}
```

### Pagination Contract
All high-volume and list endpoints adhere to a unified pagination model:

#### Query Parameters
| Parameter | Type | Default | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Min: `1` | Page number to retrieve |
| `limit` | `integer` | *Endpoint Default* | Min: `1`, Max: `100` | Number of items per page |
| `search` | `string` | *None* | Max: `100` chars | Case-insensitive literal substring search |

*Default limits per endpoint:*
- `/reference/languages`: **20**
- `/reference/fields-of-study`: **20**
- `/reference/skills-taxonomy` (flat/filtered mode): **50**
- `/profile/skills`: **10**
- `/profile/languages`: **10**
- `/profile/educations`: **10**
- `/profile/documents`: **10**

#### Metadata Block (`meta.pagination`)
```typescript
interface PaginationMeta {
  page: number;        // Current page number
  limit: number;       // Items requested per page
  total: number;       // Total records matching criteria
  totalPages: number;  // Total pages available (Math.ceil(total / limit))
  hasNext: boolean;    // Whether a subsequent page exists
  hasPrev: boolean;    // Whether a preceding page exists
}
```

---

## 2. Authentication, Rate Limiting & Security Rules

1. **Authentication (JWT)**:
   - All `/profile/*` endpoints require the `Authorization: Bearer <accessToken>` header.
   - User identity (`userId`) is strictly resolved from the JWT payload. Attempting to supply `userId` in the body or query string will trigger a `400 Bad Request` or be rejected by `forbidNonWhitelisted`.
   - All `/reference/*` endpoints are **public** and do **not** require an `Authorization` header.
2. **UUID Route Validation**:
   - Every UUID path parameter (such as `:skillId`, `:languageId`, `:educationId`, `:documentId`) is strictly validated at the routing layer via `ParseUUIDPipe`. Supplying non-UUID values (e.g. `123` or `slug`) immediately returns `400 Bad Request` (or `404 Not Found` for document ID).
3. **Whitelist & Strict Body Validation**:
   - The backend runs with `whitelist: true` and `forbidNonWhitelisted: true`. Submitting undeclared fields in any JSON payload will immediately reject the request with `400 Bad Request`.
4. **Rate Limiting**:
   - `/reference/*` endpoints: **60 requests / 60 seconds** per client IP. (Fails open if Redis is unavailable).
   - `/auth/login` and `/auth/register`: **5 requests / 60 seconds** per client IP.
   - HTTP Status `429 Too Many Requests` is returned when limits are exceeded.

---

## 3. Profile Completion & Scoring Logic

The profile completion progress (`completionPct`) is an integer between `0` and `100` calculated deterministically by the server. It is returned on `GET /profile` and `PATCH /profile`.

### Scoring Breakdown
| Category | Field / Condition | Weight | Notes |
| :--- | :--- | :--- | :--- |
| **Core Fields (40%)** | `educationLevelId` (Education Level) | **15%** | Standardised Education Level UUID or key |
| | `fieldOfStudy` (Field of Study) | **15%** | Array with at least 1 non-empty item |
| | `nationality` (Nationality) | **10%** | Non-empty string |
| **Additional Fields (60%)** | `fullName` | **5%** | Non-empty string |
| *(12 items × 5% each)* | `dateOfBirth` | **5%** | Valid date |
| | `currentCountry` | **5%** | Non-empty string |
| | `currentCity` | **5%** | Non-empty string |
| | `phone` | **5%** | Non-empty string |
| | `experienceLevel` | **5%** | Non-empty string |
| | `hasFinancialNeed` | **5%** | Boolean (`true` or `false`) |
| | `careerGoals` | **5%** | String with length > 20 chars |
| | `userSkills` | **5%** | At least 1 skill added |
| | `userLanguages` | **5%** | At least 1 language added |
| | `documents` | **5%** | At least 1 document uploaded |
| | `profilePhotoUrl` | **5%** | Non-empty URL string |

> **Note on `coreFieldsComplete`**: Evaluates to `true` **only** when `educationLevelId`, `fieldOfStudy` (≥1 entry), and `nationality` are all populated. Publishing a profile (`POST /profile/publish`) requires `coreFieldsComplete: true`.

---

## 4. Reference Data Endpoints (Public)

These endpoints provide standardised choices for form dropdowns, lookups, and the application's locale switcher.

---

### 4.1 Get Supported App Languages (UI Locales)
Returns the static, curated list of frontend interface languages with writing direction.

- **Method**: `GET`
- **URL**: `/reference/app-languages`
- **Auth Required**: No (Public)
- **Rate Limit**: 60 req/min

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

### 4.2 Get Standardised Education Levels
Returns the canonical list of active education qualifications with both English and Arabic labels.

- **Method**: `GET`
- **URL**: `/reference/education-levels`
- **Auth Required**: No (Public)
- **Rate Limit**: 60 req/min

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Education levels retrieved successfully",
  "data": [
    {
      "id": "a0000000-0000-0000-0000-000000000003",
      "name": "bachelor",
      "labelEn": "Bachelor's Degree",
      "labelAr": "بكالوريوس",
      "isActive": true
    },
    {
      "id": "a0000000-0000-0000-0000-000000000006",
      "name": "certificate",
      "labelEn": "Certificate / Diploma Course",
      "labelAr": "شهادة مهنية",
      "isActive": true
    },
    {
      "id": "a0000000-0000-0000-0000-000000000002",
      "name": "diploma",
      "labelEn": "Associate Degree / Diploma",
      "labelAr": "دبلوم متوسط",
      "isActive": true
    },
    {
      "id": "a0000000-0000-0000-0000-000000000001",
      "name": "high_school",
      "labelEn": "High School",
      "labelAr": "ثانوية عامة",
      "isActive": true
    },
    {
      "id": "a0000000-0000-0000-0000-000000000004",
      "name": "master",
      "labelEn": "Master's Degree",
      "labelAr": "ماجستير",
      "isActive": true
    },
    {
      "id": "a0000000-0000-0000-0000-000000000007",
      "name": "other",
      "labelEn": "Other",
      "labelAr": "أخرى",
      "isActive": true
    },
    {
      "id": "a0000000-0000-0000-0000-000000000005",
      "name": "phd",
      "labelEn": "Doctorate / PhD",
      "labelAr": "دكتوراه",
      "isActive": true
    }
  ],
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 4.3 Get Master Languages
Returns the paginated master list of spoken/written languages.

- **Method**: `GET`
- **URL**: `/reference/languages`
- **Auth Required**: No (Public)
- **Rate Limit**: 60 req/min

#### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `20` | Max items (up to 100) |
| `search` | `string` | - | Substring search by language name (e.g. `eng` or `arab`) |

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
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 4.4 Get Fields of Study
Returns the paginated master list of academic fields and disciplines.

- **Method**: `GET`
- **URL**: `/reference/fields-of-study`
- **Auth Required**: No (Public)

#### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `20` | Items per page (max 100) |
| `search` | `string` | - | Substring search on field name (e.g. `Computer`) |
| `category` | `string` | - | Exact category filter (e.g. `Engineering & Technology`) |

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Fields of study retrieved successfully",
  "data": [
    {
      "id": "c1111111-1111-1111-1111-111111111111",
      "name": "Computer Science",
      "category": "Engineering & Technology"
    },
    {
      "id": "c2222222-2222-2222-2222-222222222222",
      "name": "Software Engineering",
      "category": "Engineering & Technology"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 4.5 Get Skills Taxonomy
Retrieves the master taxonomy of skills. Supports a **dual response mode**:
1. **Grouped Hierarchy (Default)**: When invoked with no parameters, returns skills grouped by category.
2. **Flat Paginated List**: When any filter (`search`, `category`, `page`, or `limit`) is passed, returns a flat paginated list.

- **Method**: `GET`
- **URL**: `/reference/skills-taxonomy`
- **Auth Required**: No (Public)

#### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Page number (triggers flat mode) |
| `limit` | `integer` | `50` | Max items (up to 100) |
| `search` | `string` | - | Substring search on skill name (triggers flat mode) |
| `category` | `string` | - | Category filter (triggers flat mode) |

#### Response `200 OK` (Default Grouped Mode: `GET /reference/skills-taxonomy`)
```json
{
  "statusCode": 200,
  "message": "Skills taxonomy retrieved successfully",
  "data": [
    {
      "category": "Technology",
      "skills": [
        { "id": "s1111111-1111-1111-1111-111111111111", "name": "TypeScript" },
        { "id": "s2222222-2222-2222-2222-222222222222", "name": "React" }
      ]
    },
    {
      "category": "Design",
      "skills": [
        { "id": "s3333333-3333-3333-3333-333333333333", "name": "Figma" }
      ]
    }
  ],
  "meta": {
    "pagination": null
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

#### Response `200 OK` (Flat Paginated Mode: `GET /reference/skills-taxonomy?search=type`)
```json
{
  "statusCode": 200,
  "message": "Skills taxonomy retrieved successfully",
  "data": [
    {
      "id": "s1111111-1111-1111-1111-111111111111",
      "name": "TypeScript",
      "category": "Technology"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 50,
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

## 5. Profile General Endpoints

Manage core personal details, view overall completion status, and publish the profile.

---

### 5.1 Get User Profile
Fetches the full profile details of the authenticated user, including sub-collections and completion metrics.

- **Method**: `GET`
- **URL**: `/profile`
- **Auth Required**: Yes (`Bearer <token>`)

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
    "careerGoals": "Seeking software engineering scholarships and research grants in AI.",
    "profilePhotoUrl": "https://storage.levora.org/avatars/user.jpg",
    "completionPct": 85,
    "coreFieldsComplete": true,
    "lastCompletedStep": 2,
    "gpaNormalized4": 3.8,
    "skills": [
      {
        "skillId": "s1111111-1111-1111-1111-111111111111",
        "name": "TypeScript",
        "proficiency": 4
      }
    ],
    "languages": [
      {
        "languageId": "22222222-2222-2222-2222-222222222222",
        "name": "English",
        "proficiency": "Fluent"
      }
    ],
    "educations": [
      {
        "id": "e1111111-1111-1111-1111-111111111111",
        "institution": "University of Jordan",
        "degree": "Bachelor of Science",
        "major": "Computer Science",
        "graduationYear": 2024,
        "gpaNormalized4": 3.8
      }
    ],
    "documents": [
      {
        "id": "d1111111-1111-1111-1111-111111111111",
        "docType": "resume",
        "displayName": "Jane_Doe_CV.pdf"
      }
    ]
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

### 5.2 Update User Profile
Partially updates the user's profile details.

- **Method**: `PATCH`
- **URL**: `/profile`
- **Auth Required**: Yes (`Bearer <token>`)

#### Request Body (`application/json`)
| Field | Type | Optional | Validation Rules | Description |
| :--- | :--- | :--- | :--- | :--- |
| `fullName` | `string` | Yes | Max 255 chars, sanitised | Full name |
| `dateOfBirth` | `string` (ISO date) | Yes | Valid date format | Date of birth |
| `nationality` | `string` | Yes | Max 255 chars | Nationality. Cannot be cleared if set |
| `educationLevel` | `string` (UUID or name) | Yes | Valid `EducationLevel` UUID or name (`bachelor`, `high_school`, etc.) | Highest qualification. Cannot be cleared if set |
| `fieldOfStudy` | `string[]` | Yes | Array of strings, max 5 items | Disciplines/majors. Cannot be cleared if already populated |
| `currentCountry` | `string` | Yes | Max 255 chars | Country of residence |
| `currentCity` | `string` | Yes | Max 255 chars | City of residence |
| `phone` | `string` | Yes | Max 255 chars | Contact phone number |
| `experienceLevel`| `string` | Yes | Max 255 chars | Experience level (e.g. `Junior`, `Mid`, `Senior`) |
| `hasFinancialNeed`| `boolean` | Yes | `true` or `false` | Financial assistance status |
| `careerGoals` | `string` | Yes | Max 500 chars | Career goals statement |
| `profilePhotoUrl`| `string` | Yes | Max 255 chars, valid URL format | Photo URL |

```json
{
  "fullName": "Jane Doe",
  "nationality": "Jordanian",
  "educationLevel": "bachelor",
  "fieldOfStudy": ["Computer Science"],
  "currentCountry": "Jordan",
  "currentCity": "Amman",
  "hasFinancialNeed": false,
  "careerGoals": "Seeking postgraduate opportunities in AI and Machine Learning."
}
```

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

#### Common Error Responses
- `400 Bad Request`: Validation failure (unknown field, invalid `educationLevel`, attempting to clear a required field such as `nationality` or `educationLevel`).

---

### 5.3 Publish Profile
Locks in and marks the profile as publicly active. Requires core fields (`educationLevel`, `fieldOfStudy`, `nationality`) to be complete.

- **Method**: `POST`
- **URL**: `/profile/publish`
- **Auth Required**: Yes (`Bearer <token>`)
- **Body**: None

#### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Profile published successfully",
  "data": {
    "isPublished": true,
    "publishedAt": "2026-09-20T08:30:00.000Z"
  },
  "timestamp": "2026-09-20T08:30:00.000Z"
}
```

#### Common Error Responses
- `409 Conflict`: 
  - Profile is already published.
  - Core fields incomplete (`coreFieldsComplete: false`).

---

## 6. Profile Sub-Resources

All sub-resources operate within the authenticated user's scope. Attempting to modify or access a record belonging to another user will fail the ownership guard (`404 Not Found`).

---

### 6.1 Skills (`/profile/skills`)

#### 6.1.1 Get All User Skills
- **Method**: `GET`
- **URL**: `/profile/skills`
- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**: `page` (default 1), `limit` (default 10, max 100).

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Skills retrieved successfully",
  "data": [
    {
      "id": "us111111-1111-1111-1111-111111111111",
      "skillId": "s1111111-1111-1111-1111-111111111111",
      "proficiency": 4,
      "skill": {
        "id": "s1111111-1111-1111-1111-111111111111",
        "name": "TypeScript",
        "category": "Technology"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
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

#### 6.1.2 Get Skill by ID
- **Method**: `GET`
- **URL**: `/profile/skills/:skillId`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:skillId` — must be a valid UUID.

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Skill retrieved successfully",
  "data": {
    "id": "us111111-1111-1111-1111-111111111111",
    "skillId": "s1111111-1111-1111-1111-111111111111",
    "proficiency": 4,
    "skill": {
      "id": "s1111111-1111-1111-1111-111111111111",
      "name": "TypeScript",
      "category": "Technology"
    }
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

#### 6.1.3 Add Skill to Profile
- **Method**: `POST`
- **URL**: `/profile/skills`
- **Auth Required**: Yes (`Bearer <token>`)

##### Request Body (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `skillId` | `string` (UUID) | Yes | UUID from `SkillsMaster` |
| `proficiency` | `integer` | Yes | Level from `1` (Beginner) to `5` (Expert) |

```json
{
  "skillId": "s1111111-1111-1111-1111-111111111111",
  "proficiency": 4
}
```

##### Response `201 Created`
```json
{
  "statusCode": 201,
  "message": "Skill added successfully",
  "data": {
    "id": "us111111-1111-1111-1111-111111111111",
    "userId": "u1111111-1111-1111-1111-111111111111",
    "skillId": "s1111111-1111-1111-1111-111111111111",
    "proficiency": 4
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

#### 6.1.4 Update User Skill
- **Method**: `PATCH`
- **URL**: `/profile/skills/:skillId`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:skillId` — must be a valid UUID.

##### Request Body (`application/json`)
```json
{
  "proficiency": 5
}
```

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Skill updated successfully",
  "data": {
    "id": "us111111-1111-1111-1111-111111111111",
    "proficiency": 5
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

#### 6.1.5 Remove Skill from Profile
- **Method**: `DELETE`
- **URL**: `/profile/skills/:skillId`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:skillId` — must be a valid UUID.
- **Response**: `204 No Content` (Empty body)

---

### 6.2 Languages (`/profile/languages`)

#### 6.2.1 Get All User Languages
- **Method**: `GET`
- **URL**: `/profile/languages`
- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**: `page` (default 1), `limit` (default 10, max 100).

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Return all user languages.",
  "data": [
    {
      "id": "ul111111-1111-1111-1111-111111111111",
      "languageId": "22222222-2222-2222-2222-222222222222",
      "proficiency": "Fluent",
      "language": {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "English"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
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

#### 6.2.2 Get User Language by ID
- **Method**: `GET`
- **URL**: `/profile/languages/:languageId`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:languageId` — must be a valid UUID.

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Return the user language.",
  "data": {
    "id": "ul111111-1111-1111-1111-111111111111",
    "languageId": "22222222-2222-2222-2222-222222222222",
    "proficiency": "Fluent",
    "language": {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "English"
    }
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

#### 6.2.3 Add Language to Profile
- **Method**: `POST`
- **URL**: `/profile/languages`
- **Auth Required**: Yes (`Bearer <token>`)

##### Request Body (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `languageId` | `string` (UUID) | Yes | Master language UUID from `/reference/languages` |
| `proficiency` | `string` | Yes | e.g. `Native`, `Fluent`, `Intermediate`, `Basic` |

```json
{
  "languageId": "22222222-2222-2222-2222-222222222222",
  "proficiency": "Fluent"
}
```

##### Response `201 Created`
```json
{
  "statusCode": 201,
  "message": "Language added successfully.",
  "data": {
    "id": "ul111111-1111-1111-1111-111111111111",
    "userId": "u1111111-1111-1111-1111-111111111111",
    "languageId": "22222222-2222-2222-2222-222222222222",
    "proficiency": "Fluent"
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

#### 6.2.4 Update User Language
- **Method**: `PATCH`
- **URL**: `/profile/languages/:languageId`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:languageId` — must be a valid UUID.

##### Request Body (`application/json`)
```json
{
  "proficiency": "Native"
}
```

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Language updated successfully.",
  "data": {
    "id": "ul111111-1111-1111-1111-111111111111",
    "proficiency": "Native"
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

#### 6.2.5 Remove Language from Profile
- **Method**: `DELETE`
- **URL**: `/profile/languages/:languageId`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:languageId` — must be a valid UUID.
- **Response**: `204 No Content` (Empty body)

---

### 6.3 Educations (`/profile/educations`)

#### 6.3.1 Get All Education Records
- **Method**: `GET`
- **URL**: `/profile/educations`
- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**: `page` (default 1), `limit` (default 10, max 100).

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "OK",
  "data": [
    {
      "id": "e1111111-1111-1111-1111-111111111111",
      "userId": "u1111111-1111-1111-1111-111111111111",
      "institution": "University of Jordan",
      "degree": "Bachelor of Science",
      "major": "Computer Science",
      "graduationYear": 2024,
      "gpaValue": 3.8,
      "gpaScale": "4.0",
      "gpaNormalized4": 3.8
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
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

#### 6.3.2 Add Education Record
- **Method**: `POST`
- **URL**: `/profile/educations`
- **Auth Required**: Yes (`Bearer <token>`)

##### Request Body (`application/json`)
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `institution` | `string` | Yes | Max 255 chars, sanitised | University / School name |
| `degree` | `string` | Yes | Max 255 chars, sanitised | Degree title (e.g. `Bachelor of Science`) |
| `major` | `string` | Yes | Max 255 chars, sanitised | Major / Specialization |
| `graduationYear` | `integer` | No | Between `1900` and `2100` | Graduation or expected year |

```json
{
  "institution": "University of Jordan",
  "degree": "Bachelor of Science",
  "major": "Computer Science",
  "graduationYear": 2024
}
```

##### Response `201 Created`
```json
{
  "statusCode": 201,
  "message": "Created successfully",
  "data": {
    "id": "e1111111-1111-1111-1111-111111111111",
    "userId": "u1111111-1111-1111-1111-111111111111",
    "institution": "University of Jordan",
    "degree": "Bachelor of Science",
    "major": "Computer Science",
    "graduationYear": 2024,
    "createdAt": "2026-09-20T08:00:00.000Z",
    "updatedAt": "2026-09-20T08:00:00.000Z"
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

#### 6.3.3 Update Education Record
- **Method**: `PATCH`
- **URL**: `/profile/educations/:id`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:id` — Education record UUID.

##### Request Body (`application/json`)
All fields from creation are optional, plus GPA configuration:
| Field | Type | Description |
| :--- | :--- | :--- |
| `institution` | `string` | Updated institution |
| `degree` | `string` | Updated degree |
| `major` | `string` | Updated major |
| `graduationYear` | `integer` | Updated graduation year |
| `gpaValue` | `number` | Numerical GPA value (Required if `gpaScale` is passed) |
| `gpaScale` | `string` | One of: `'4.0'`, `'percentage'`, `'letter'` |

```json
{
  "graduationYear": 2025,
  "gpaValue": 3.85,
  "gpaScale": "4.0"
}
```

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "Updated successfully",
  "data": {
    "id": "e1111111-1111-1111-1111-111111111111",
    "institution": "University of Jordan",
    "degree": "Bachelor of Science",
    "major": "Computer Science",
    "graduationYear": 2025,
    "gpaValue": 3.85,
    "gpaScale": "4.0",
    "gpaNormalized4": 3.85
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

#### 6.3.4 Delete Education Record
- **Method**: `DELETE`
- **URL**: `/profile/educations/:id`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:id` — Education record UUID.
- **Response**: `204 No Content` (Empty body)

---

### 6.4 Documents (`/profile/documents`)

Upload and manage resumes, transcripts, recommendation letters, and essays. Files are scanned for MIME type/magic numbers, encrypted at rest, and stored securely. Internal `storagePath` is strictly omitted from all client responses for security.

#### 6.4.1 Upload Document
- **Method**: `POST`
- **URL**: `/profile/documents`
- **Auth Required**: Yes (`Bearer <token>`)
- **Content-Type**: `multipart/form-data`

##### Multipart Form Fields
| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `file` | `Binary file` | Yes | Max file size: **5MB**. Allowed formats: `.pdf`, `.doc`, `.docx`, `.png`, `.jpg`, `.jpeg`. Content signature is strictly validated against magic numbers. |
| `docType` | `string` | No | One of: `resume`, `essay`, `transcript`, `recommendation_letter`, `other`. Default: `other`. |

##### Response `201 Created`
```json
{
  "statusCode": 201,
  "message": "Created successfully",
  "data": {
    "id": "d1111111-1111-1111-1111-111111111111",
    "userId": "u1111111-1111-1111-1111-111111111111",
    "docType": "resume",
    "displayName": "Jane_Doe_Resume.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 245120,
    "isEncrypted": true,
    "createdAt": "2026-09-20T08:00:00.000Z"
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

---

#### 6.4.2 List User Documents
- **Method**: `GET`
- **URL**: `/profile/documents`
- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**: `page` (default 1), `limit` (default 10, max 100).

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "OK",
  "data": [
    {
      "id": "d1111111-1111-1111-1111-111111111111",
      "userId": "u1111111-1111-1111-1111-111111111111",
      "docType": "resume",
      "displayName": "Jane_Doe_Resume.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 245120,
      "isEncrypted": true,
      "createdAt": "2026-09-20T08:00:00.000Z",
      "updatedAt": "2026-09-20T08:00:00.000Z",
      "deletedAt": null
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
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

#### 6.4.3 Get Document Download URL
Generates a time-limited signed URL for secure file download or preview.

- **Method**: `GET`
- **URL**: `/profile/documents/:id/download`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:id` — Document UUID.

##### Response `200 OK`
```json
{
  "statusCode": 200,
  "message": "OK",
  "data": {
    "url": "http://localhost:3000/api/v1/local-storage/documents%2Fu1111111-1111-1111-1111-111111111111%2F1726820000000-resume.pdf?token=eyJhbGciOi...",
    "expiresAt": "2026-09-20T08:15:00.000Z"
  },
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

> **Frontend Usage**: Open this `url` directly in a new browser tab or download anchor. The token contains a cryptographic HMAC signature valid for 15 minutes.

---

#### 6.4.4 Delete Document
- **Method**: `DELETE`
- **URL**: `/profile/documents/:id`
- **Auth Required**: Yes (`Bearer <token>`)
- **Route Param**: `:id` — Document UUID.
- **Response**: `204 No Content` (Empty body)

---

## 7. Error Handling & Common HTTP Codes

The API returns consistent error payloads matching the Levora standard:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "educationLevelId",
      "code": "VALIDATION_INVALID_FORMAT",
      "message": "educationLevelId must be a UUID"
    }
  ],
  "timestamp": "2026-09-20T08:00:00.000Z"
}
```

| HTTP Status | Meaning | When It Occurs |
| :--- | :--- | :--- |
| `400 Bad Request` | Validation Failure | Malformed UUID route param, undeclared fields in body (`forbidNonWhitelisted`), clearing required fields, invalid file type/signature. |
| `401 Unauthorized` | Missing / Invalid Token | Authorization header missing or expired JWT. |
| `403 Forbidden` | Access Denied | User does not have rights to perform action. |
| `404 Not Found` | Resource Not Found | Record does not exist, was soft-deleted, or belongs to another user (IDOR protection). |
| `409 Conflict` | State Conflict | Profile already published or cannot publish due to incomplete core fields. |
| `429 Too Many Requests` | Rate Limited | Exceeded 60 req/min on `/reference/*` or 5 req/min on `/auth/*`. |
| `500 Internal Error` | Server Error | Unhandled backend exception. |

---

## 8. Frontend Integration Quick Reference Checklist

1. **Populating Registration / Profile Wizards**:
   - Call `GET /reference/app-languages` to initialize UI language switcher.
   - Call `GET /reference/education-levels` to render qualification options in dropdowns.
   - Use `GET /reference/languages?search={term}` with debounce (300ms) for language search-as-you-type.
   - Use `GET /reference/fields-of-study?search={term}` with debounce for field-of-study auto-complete.
   - Use `GET /reference/skills-taxonomy` to display grouped skills or `GET /reference/skills-taxonomy?search={term}` for dynamic skill pickers.
2. **Profile Completion Progress**:
   - Read `data.completionPct` from `GET /profile` or `PATCH /profile` to drive the progress bar UI.
   - Check `data.coreFieldsComplete` before enabling the "Publish Profile" CTA.
3. **Pagination Handling**:
   - Check `meta.pagination.hasNext` to enable or disable infinite scroll / "Next Page" buttons.
   - Store and display `meta.pagination.total` for counts (e.g. "Showing 10 of 42 skills").
4. **Document Uploads**:
   - Use `multipart/form-data` with key `file`.
   - Never exceed 5MB. Pre-validate extensions on the client side (`.pdf`, `.doc`, `.docx`, `.png`, `.jpg`, `.jpeg`).
   - Use `GET /profile/documents/:id/download` to get a signed URL whenever the user clicks "Preview" or "Download".
