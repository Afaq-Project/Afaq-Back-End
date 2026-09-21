# Data Model: Profile Preferences (Batch 5)

**Feature**: 009-profile-preferences
**Date**: 2026-09-21
**Schema version**: 2.0 (canonical source: `docx/complete-schema.md`)

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Entities Managed in this Spec

This spec owns the four pivot tables:
- `UserSpecialStatuses`
- `UserTargetDegrees`
- `UserTargetMajors`
- `UserTargetInstitutions`

And uses reference entities:
- `SpecialStatuses` (seeded in Batch 1)
- `EducationLevel` (seeded in Batch 1)
- `Majors` (seeded in Batch 2)
- `Institutions` (seeded in Batch 2)

---

## Pivot Tables (Many-to-Many)

| Table | PK | FK 1 | FK 2 |
|:---|:---|:---|:---|
| `UserSpecialStatuses` | (userId, specialStatusId) | UserProfiles.userId | SpecialStatuses.id |
| `UserTargetDegrees` | (userId, educationLevelId) | UserProfiles.userId | EducationLevel.id |
| `UserTargetMajors` | (userId, majorId) | UserProfiles.userId | Majors.id |
| `UserTargetInstitutions` | (userId, institutionId) | UserProfiles.userId | Institutions.id |

All cascade-delete when profile is deleted. All have configurable limits from SystemSettings.

**Deduplication**: All four tables use upsert semantics — a duplicate add is silently ignored (no error, no duplicate row).

---

## SystemSettings Limits

| Key | Default |
|:---|:---:|
| `MAX_TARGET_DEGREES` | 5 |
| `MAX_TARGET_MAJORS` | 10 |
| `MAX_TARGET_INSTITUTIONS` | 10 |

---

## completionPct Contribution (this spec)

| Group | Points |
|:---|:---:|
| `userSpecialStatuses.length > 0` | 3 |
| `userTargetMajors.length > 0` | 5 |
| `userTargetDegrees.length > 0` | 4 |
| `userTargetInstitutions.length > 0` | 3 |
| **Total (this spec)** | **15** |

After Batch 5, all 6 completion groups are active and the profile can reach `completionPct = 100`.
