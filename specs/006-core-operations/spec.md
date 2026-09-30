# Feature Specification: Core Operations Module (Admin v1)

**Feature Branch**: `006-core-operations`

**Created**: 2026-09-27

**Status**: Draft

---

## Overview

The Core Operations Module (formerly referred to as the Admin Module) introduces foundational administrative capabilities to the system. It enables authorized personnel to manage users, monitor system health via audit logs and dashboard statistics, oversee uploaded documents, configure global system settings, and maintain the reference (master) data that powers the application.

This module is designed strictly for system data management. Domain-specific administrative tasks (such as managing a scraping engine) are excluded from this namespace and belong to their respective modules, protected by specific permission guards.

---

## Clarifications & Scope Constraints

- **Payments & Subscriptions**: Although `Subscriptions` and `Payments` exist in the database schema, actual payment processing is not yet supported. Dashboard statistics and user suspension logic will ignore these entities for now.
- **User Deletion (`deletedAt`)**: Deletion in the context of user management involves **soft deletion** by setting the `deletedAt` timestamp. Permanent removal (hard deletion) of users is not supported in this version.
- **Notifications**: Automated notifications (e.g., notifying a user when their document is deleted) are deferred as the notification system is not yet fully implemented.
- **Master Data Deactivation**: When a reference data record (e.g., an Institution or Major) is deactivated (`isActive: false`), it will be hidden from public dropdowns to prevent new selections. However, existing user profiles that already selected the item will retain it, ensuring historical data integrity.

### Session 2026-09-27
- Q: Should administrators be allowed to suspend their own accounts or modify their own roles? → A: Allow self-modification, assuming administrators are responsible for their actions.
- Q: If the external storage provider fails to delete a document, should the DB record still be deleted? → A: Fail the operation and preserve the DB record so it can be retried.
- Q: How should the audit log export handle potentially large datasets? → A: Cancel the export feature entirely; it is no longer needed.

### Session 2026-09-28
- Q: How is a user profile considered "matchable" for the dashboard stat? → A: A profile is matchable when its completion percentage meets or exceeds the `matching.threshold` value (default 60%) stored in `SystemSettings`. Admins control this threshold via the settings endpoints.
- Q: What is the maximum batch size for bulk user status changes? → A: 100 records per request (industry standard).

---

## User Scenarios & Testing

### User Story 1 — Admin Dashboard Statistics
An admin logs in and navigates to the dashboard to get a bird's-eye view of the system. The dashboard displays key metrics: total registered users, a breakdown of active vs. suspended users, the total number of "matchable" profiles, and the total count of documents uploaded across the system.

**Acceptance Scenarios**:
1. **Given** an authorized admin, **When** they request dashboard stats, **Then** the system returns accurate counts for users (total, active, suspended, matchable) and total documents without exposing any financial metrics.

### User Story 2 — User Account Management & Suspension
An admin needs to take action against a user who violated the terms of service. The admin locates the user via search, reviews their profile, suspends their account (`isActive = false`), and forces a logout. Later, the admin decides to soft-delete the user (`deletedAt`).

**Acceptance Scenarios**:
1. **Given** an admin searching for a user, **When** they query by email or name, **Then** they receive a paginated list of matching users.
2. **Given** a user suspension action, **When** the admin sets a user to inactive, **Then** the user is unable to acquire new access tokens. 
3. **Given** an admin triggering a force-logout, **When** the action is taken, **Then** the user's refresh tokens are invalidated immediately.
4. **Given** an admin triggering a password reset, **When** executed, **Then** the system generates a secure token and initiates the reset email flow, without returning the new password to the admin.
5. **Given** an admin soft-deleting a user, **When** the delete action is executed, **Then** the `deletedAt` timestamp is populated, and the user is prevented from logging in entirely.

### User Story 3 — Master Data Administration
An admin needs to add a newly accredited University to the system and deactivate an old major that is no longer offered. 

**Acceptance Scenarios**:
1. **Given** an admin creating a new Institution, **When** they submit the English and Arabic names, **Then** it immediately becomes available in the public dropdowns.
2. **Given** an admin deactivating a Major, **When** `isActive` is set to false, **Then** the Major no longer appears in public endpoints, but profiles that previously selected it are unaffected.

### User Story 4 — System Settings Management
An admin needs to adjust the system-wide threshold for a profile to be considered "matchable" without requiring a code deployment.

**Acceptance Scenarios**:
1. **Given** an admin updating the settings, **When** they patch the specific JSON key in `SystemSettings`, **Then** the system immediately applies the new rule for all subsequent profile completion calculations.

### User Story 5 — Audit Log Review
A security auditor needs to see who suspended a specific user and when. They view the detailed audit logs to trace the action.

**Acceptance Scenarios**:
1. **Given** an admin reviewing logs, **When** they view a log entry, **Then** they can see the exact `oldData`, `newData`, and the identity of the admin (actor) who triggered the change.

### User Story 6 — Document Oversight
An admin routinely audits uploaded documents. They find an inappropriate image uploaded as an ID and delete it.

**Acceptance Scenarios**:
1. **Given** an admin reviewing documents, **When** they request to download a specific document, **Then** they receive access to view the file regardless of standard ownership rules.
2. **Given** an admin deleting a document, **When** the delete action is executed, **Then** the file is permanently removed from storage and the database record is hard-deleted.

---

## Functional Requirements

#### User Management
- **FR-001**: The system MUST allow admins to list, filter (by status and role), and search users by name and email.
- **FR-002**: Admins MUST be able to toggle the `isActive` status of a user, including their own account (self-modification is permitted).
- **FR-003**: Admins MUST be able to apply status changes to multiple users in bulk, with a maximum of **100 user IDs per request**. Requests exceeding this limit MUST be rejected with a validation error.
- **FR-004**: Deleting a user via the admin panel MUST perform a soft delete by setting the `deletedAt` timestamp.
- **FR-005**: Admins MUST be able to trigger a password reset flow for a user. This MUST NOT expose a raw password; it MUST trigger an email token flow.
- **FR-006**: Admins MUST be able to trigger a "force logout", which MUST invalidate the user's active refresh tokens via the Redis token store.
- **FR-007**: Admins MUST be permitted to modify their own roles without system-imposed restrictions.

#### Dashboard
- **FR-008**: The dashboard MUST aggregate and return: total users, total active users, total matchable profiles (where a profile is matchable when its completion percentage ≥ the `matching.threshold` value in `SystemSettings`, defaulting to 60%), and total documents. It MUST NOT process financial/subscription data in this version.

#### Master Data Administration
- **FR-009**: Admins MUST be able to create new records in all master data tables (Countries, Cities, Institutions, Majors, etc.).
- **FR-010**: Admins MUST be able to partially update master data records, primarily to toggle the `isActive` flag.
- **FR-011**: A master data record marked as `isActive: false` MUST NOT be returned in `[PUBLIC]` reference endpoints used for dropdowns, but MUST still be successfully joined/resolved when fetching existing user profiles.

#### System Settings
- **FR-012**: Admins MUST be able to list and update JSON configurations in the `SystemSettings` table.

#### Audit & Logging
- **FR-013**: System modifications performed through the operations module MUST be logged in the `ChangeLog` table, recording `oldData`, `newData`, and the `changedBy` (initiator) user ID.
- **FR-014**: Admins MUST be able to list audit log entries with pagination and filtering, and MUST be able to view the full details of any individual log entry.

#### Document Oversight
- **FR-015**: Admins MUST be able to list all documents uploaded by any user.
- **FR-016**: Admins MUST be able to download any document, bypassing standard user-ownership restrictions.
- **FR-017**: Document deletion by an admin MUST perform a hard delete. If the external storage provider (e.g., S3) fails to delete the file, the operation MUST fail and preserve the database record to prevent orphaned files.

---

## Key Entities

- **Users**: Core entity for user management. Admin actions manipulate `isActive` and `deletedAt`.
- **SystemSettings**: Key-value store (JSON) for global configurations tunable by admins.
- **ChangeLog**: The central audit table storing who changed what and when.
- **Master Tables**: (e.g., Institutions, Majors, Countries). Controlled by the reference data endpoints.
- **Documents**: Reviewed and moderated by admins.
- **UserRoles & Roles**: Determine if a user has access to the `/operations/*` namespace via granular guards.

---

## Success Criteria

- **SC-001**: An admin can successfully suspend a user, instantly preventing them from obtaining new access tokens.
- **SC-002**: An admin can perform a soft-delete on a user, successfully populating the `deletedAt` field and locking the user out.
- **SC-003**: Dashboard statistics load successfully and accurately reflect the database state without errors regarding non-existent payment data.
- **SC-004**: Deactivating an Institution hides it from the `/reference/institutions` public endpoint but preserves it on any `UserEducations` records that previously linked to it.
- **SC-005**: Audit logs correctly capture the admin's UUID as the initiator for all changes made via the `/operations/` routes.
- **SC-006**: Document deletion MUST call the storage provider's delete API before the DB record is removed. If storage deletion fails, the DB record MUST NOT be removed.
- **SC-007**: A bulk status update request with more than 100 user IDs is rejected with a validation error; a request with 100 or fewer is processed successfully.

---

## Assumptions

- No email notifications or in-app notifications will be triggered by admin actions (like document deletion or account suspension) as the notification system is not yet active.
- Access to the `/operations/*` routes is governed by granular permission guards configured during module implementation, allowing scalable role setups (Level 1, Level 2 admins).
- The `OauthIdentities` or Redis session store contains sufficient information to securely invalidate refresh tokens during a force-logout.
