# API Contract — Batch 5: Special Statuses & Target Preferences

## Special Statuses

### POST /profile/special-statuses

```json
{ "specialStatusId": "uuid" }
```

Idempotent — adding an existing status produces no error and no duplicate.

**Response**: `{ "userId": "uuid", "specialStatusId": "uuid", "specialStatus": { "nameEn": "...", "nameAr": "..." } }`

### GET /profile/special-statuses

Returns array of status records.

### DELETE /profile/special-statuses/:specialStatusId

204 No Content.

---

## Target Preferences

### GET /profile/preferences

Returns all three preference groups in a single response:

```json
{
  "targetDegrees": [
    { "educationLevelId": "uuid", "educationLevel": { "code": "master", "nameEn": "Master's Degree", "nameAr": "ماجستير" } }
  ],
  "targetMajors": [
    { "majorId": "uuid", "major": { "nameEn": "Computer Science", "nameAr": "علوم الحاسب" } }
  ],
  "targetInstitutions": [
    { "institutionId": "uuid", "institution": { "nameEn": "MIT", "nameAr": "معهد ماساتشوستس" } }
  ]
}
```

### POST /profile/preferences/degrees

```json
{ "educationLevelId": "uuid" }
```

Max: `MAX_TARGET_DEGREES` (default 5). Idempotent.

### DELETE /profile/preferences/degrees/:educationLevelId → 204

### POST /profile/preferences/majors

```json
{ "majorId": "uuid" }
```

Max: `MAX_TARGET_MAJORS` (default 10). Idempotent.

### DELETE /profile/preferences/majors/:majorId → 204

### POST /profile/preferences/institutions

```json
{ "institutionId": "uuid" }
```

Max: `MAX_TARGET_INSTITUTIONS` (default 10). Idempotent.

### DELETE /profile/preferences/institutions/:institutionId → 204

---

## Reference [PUBLIC]

### GET /reference/special-statuses

```json
[
  { "id": "uuid", "nameEn": "Orphan", "nameAr": "يتيم" },
  { "id": "uuid", "nameEn": "Person with Disability", "nameAr": "ذوي الاحتياجات الخاصة" }
]
```

---

