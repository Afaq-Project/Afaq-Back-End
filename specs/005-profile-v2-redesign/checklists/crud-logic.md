# Checklist: Profile CRUD and Matching Logic Quality

**Purpose**: Validate requirements quality for basic profile CRUD operations, database schema alignment, business logic enforcement, and matching threshold evaluation.
**Created**: 2026-09-22

## Requirement Completeness
- [ ] CHK001 - Are all database fields mapping explicitly specified for the `UserProfiles` table and all sub-records? [Completeness, Data Model]
- [ ] CHK002 - Is the validation logic defined for structured fields to reject free-text input? [Completeness, Spec §FR-022]
- [ ] CHK003 - Are constraints and formats explicitly defined for date fields (e.g., ISO 8601, startDate < endDate)? [Completeness, Data Model]
- [ ] CHK004 - Are error handling and response shapes specified for all API endpoints in the event of missing or invalid foreign keys? [Completeness, Plan]
- [ ] CHK005 - Are deduplication rules defined for all nested entities (e.g., Education, Preferences)? [Completeness, Spec §FR-031]

## Requirement Clarity
- [ ] CHK006 - Is the calculation of `completionPct` unambiguously defined based on high-weight and low-weight field inputs? [Clarity, Spec §FR-004]
- [ ] CHK007 - Is the `isMatchable` flag definition quantified clearly (e.g., exact threshold percentage)? [Clarity, Spec §FR-005]
- [ ] CHK008 - Are API request and response DTO schemas clearly detailed, including optionality and strict enums? [Clarity, Data Model]
- [ ] CHK009 - Is the trigger for `ProfileService.recalculate` clearly specified across all possible mutation paths? [Clarity, Plan Cross-Batch Invariants]

## Requirement Consistency
- [ ] CHK010 - Do the `recalculate()` behaviors remain consistent regardless of which nested profile record is updated, inserted, or deleted? [Consistency, Spec §FR-007]
- [ ] CHK011 - Are foreign key names and relations consistently documented between the schema definition and the API response DTOs? [Consistency, Data Model]
- [ ] CHK012 - Do the HTTP status codes specified for CRUD failures align with the project's global exception handling guidelines? [Consistency, Constitution §IX]
- [ ] CHK013 - Are the constraints around soft-delete vs hard-delete consistently applied across all profile sub-entities? [Consistency, Spec §FR-001]

## Acceptance Criteria Quality
- [ ] CHK014 - Is the test score range validation objectively measurable against the defined Master Data test type boundaries? [Acceptance Criteria, Spec §SC-007]
- [ ] CHK015 - Can the automatic incrementing of `matchingVersion` upon any profile mutation be objectively verified? [Measurability, Spec §SC-002]
- [ ] CHK016 - Are all reference endpoints measurable regarding their public accessibility without authentication? [Acceptance Criteria, Spec §SC-005]

## Scenario Coverage & Edge Cases
- [ ] CHK017 - Are requirements specified for when a user submits an education record with overlapping dates? [Edge Case, Gap]
- [ ] CHK018 - Does the spec define behavior when a user's completion percentage drops below the matching threshold after a deletion? [Coverage, Spec §State Transitions]
- [ ] CHK019 - Are requirements defined for the system behavior if an upstream master data item (like a city or major) is deactivated while assigned to a user? [Edge Case, Gap]
- [ ] CHK020 - Is the behavior specified for concurrent profile update requests causing race conditions in `matchingVersion` increments? [Coverage, Gap]
- [ ] CHK021 - Are requirements specified for partial profile submission failures (e.g., one valid sub-record, one invalid)? [Coverage, Exception Flow]

## Dependencies & Assumptions
- [ ] CHK022 - Are assumptions regarding upstream Auth module availability and token contents explicitly validated? [Assumption, Spec §Assumptions]
- [ ] CHK023 - Are data types for interactions with the external Python matching engine documented explicitly? [Dependency, Spec §Assumptions]

## Ambiguities & Conflicts
- [ ] CHK024 - Is there any ambiguity regarding how the GPA normalization math handles scales outside standard bounds? [Ambiguity, Data Model]
- [ ] CHK025 - Do the requirements for "TargetPreference" entries conflict with the deduplication rules if users attempt to add distinct levels but identical majors? [Conflict, Spec §FR-031]
