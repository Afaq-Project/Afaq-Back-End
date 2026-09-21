# API Contract — Batch 3: Languages

**Base path**: `/api/v1`

---

## Language CRUD

### POST /profile/languages

**Request body:**

```json
{
  "languageId": "uuid",
  "proficiencyLevelId": "uuid",
  "isNative": false
}
```

**Rules:**
- `languageId` and `proficiencyLevelId` required
- Unique: `(userId, languageId)` → 409 if duplicate
- Max: `MAX_LANGUAGES` (default 10) → 409 if exceeded

**Response:**

```json
{
  "userId": "uuid",
  "languageId": "uuid",
  "language": { "id": "uuid", "nameEn": "Arabic", "nameAr": "العربية" },
  "proficiencyLevelId": "uuid",
  "proficiencyLevel": { "id": "uuid", "nameEn": "Native", "nameAr": "اللغة الأم", "sortOrder": 5 },
  "isNative": false
}
```

---

### GET /profile/languages

Returns all language records with embedded language and proficiency names.

---

### GET /profile/languages/:languageId

Returns single language record. 404 if not found.

---

### PATCH /profile/languages/:languageId

**Request body:** (all optional)

```json
{ "proficiencyLevelId": "uuid", "isNative": true }
```

---

### DELETE /profile/languages/:languageId

**Response**: 204 No Content.

---

## Reference Endpoints [PUBLIC]

### GET /reference/languages

```json
[
  { "id": "uuid", "nameEn": "Arabic", "nameAr": "العربية", "isoCode": "ar" }
]
```

### GET /reference/proficiency-levels

Ordered by `sortOrder` ascending.

```json
[
  { "id": "uuid", "nameEn": "Beginner", "nameAr": "مبتدئ", "sortOrder": 1 },
  { "id": "uuid", "nameEn": "Intermediate", "nameAr": "متوسط", "sortOrder": 2 },
  { "id": "uuid", "nameEn": "Advanced", "nameAr": "متقدم", "sortOrder": 3 },
  { "id": "uuid", "nameEn": "Fluent", "nameAr": "طليق", "sortOrder": 4 },
  { "id": "uuid", "nameEn": "Native", "nameAr": "اللغة الأم", "sortOrder": 5 }
]
```

---

