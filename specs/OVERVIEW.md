# Profile Module — Specifications Overview

The Profile Module v2 redesign is split into **six independent specs**, one per
delivery batch. Each spec is self-contained and can be reviewed, planned, and
implemented on its own — subject to the dependencies below.

## Specs

| Spec | Batch | Scope | Status |
|:---:|:---:|:---|:---|
| `005-profile-foundation` | 1 | Auth changes, personal info, location, reference endpoints, SystemSettingsService | Planned |
| `006-profile-education` | 2 | Education records, GPA, institutions, majors, seeding | Planned |
| `007-profile-languages` | 3 | Languages, proficiency levels | Planned |
| `008-profile-tests` | 4 | Standardized tests, score validation | Planned |
| `009-profile-preferences` | 5 | Special statuses, target degrees/majors/institutions | Planned |
| `010-profile-documents` | 6 | Document upload, storage-first deletion | Planned |

## Dependencies

- `005-profile-foundation` — no dependencies; must complete first
- `006-profile-education` — depends on 005
- `007-profile-languages` — depends on 006
- `008-profile-tests` — depends on 007
- `009-profile-preferences` — depends on 008
- `010-profile-documents` — depends on 009

## Shared Artifacts

| File | Purpose |
|:---|:---|
| `docx/complete-schema.md` | Canonical Prisma schema (v2.0) |
| `docx/decisions-log.md` | All architectural decisions (DEC-*) |
| `docx/shared-research.md` | Cross-cutting technical decisions |
| `.specify/memory/constitution.md` | Project-wide rules |

## Per-Spec Content

Each spec folder contains:
- `spec.md` — User stories, functional requirements, success criteria for its batch
- `plan.md` — Batch-specific execution plan (tracks, agents, review gates)
- `tasks.md` — Batch-specific task list
- `endpoints.md` — Batch-specific endpoint specifications
- `quickstart.md` — Batch-specific validation scenarios
- `data-model.md` — Batch-specific entity definitions (scoped)
- `research.md` — Pointer file; refers to `docx/shared-research.md`
- `contracts/` — API contracts for the batch
