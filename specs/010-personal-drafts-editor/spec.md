# Feature Specification: Personal Drafts & Document Editor Integration

**Feature Branch**: `010-personal-drafts-editor`

**Created**: 2026-10-17

**Status**: Draft

## Clarifications

### Session 2026-10-17

- Q: What should the editing state of a draft become once it has been finalized into an official document? (FR-009) → A: Lock as read-only (`FINALIZED`), requiring explicit user action ("Unlock" or "New Revision") to resume editing (Option B).
- Q: What should happen in the official documents repository if a user unlocks a previously finalized draft, edits it, and finalizes it a second time? (FR-011) → A: Generate a new versioned document record in the repository (preserving historical versions intact), and automatically set this newest confirmed document as the active, approved version used in the user's profile (Option A + Profile Activation).

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Private Draft Workspace & Document Authoring (Priority: P1)

As a candidate preparing applications for scholarships, university admissions, or career opportunities, I want a dedicated private workspace where I can create, organize, and edit rich-text drafts (such as Statements of Purpose, Personal Statements, and CVs) with seamless auto-saving, so that I can refine my application materials without risk of losing my work.

**Why this priority**: This is the core functional value of the integration. Without private document creation and auto-saving, no subsequent feature (AI assistance, version history, finalization) can operate.

**Independent Test**: A user can log in, create a private workspace project (e.g., "Fulbright Application 2026"), create a document titled "Statement of Purpose", write formatted content, close the browser, and return to find their content intact.

**Acceptance Scenarios**:

1. **Given** an authenticated user in their private dashboard, **When** they create a new workspace with a custom name, **Then** a private workspace is generated that only this user can access.
2. **Given** a user editing a draft document, **When** they type or format content, **Then** the system automatically persists the changes within seconds without requiring manual save button clicks.
3. **Given** a user with multiple related documents, **When** they organize documents into nested folders/sub-pages, **Then** the visual hierarchy is preserved and easily navigable.
4. **Given** two different users on the platform, **When** both create a workspace or document with identical titles (e.g., "Personal Statements"), **Then** both succeed without naming conflicts because workspace namespaces are private and isolated per user.

---

### User Story 2 - In-Editor AI Writing Assistant (Priority: P2)

As a candidate drafting high-stakes application essays, I want an integrated AI writing assistant directly inside my editor, so that I can improve grammar, rephrase paragraphs for greater academic/professional impact, adjust tone, and brainstorm ideas without leaving the platform.

**Why this priority**: Educational and career opportunity applications require precise, persuasive writing. Having contextual AI assistance directly beside the text significantly accelerates application completion rates and enhances document quality.

**Independent Test**: A user can highlight a poorly worded paragraph in their draft, select an AI improvement action (e.g., "Improve Academic Tone" or "Check Grammar"), and review/accept the suggested replacement.

**Acceptance Scenarios**:

1. **Given** a draft document with highlighted text, **When** the user requests a transformation (rephrase, shorten, expand, or grammar check), **Then** the assistant generates a context-aware revision that the user can replace or discard.
2. **Given** a user working on a draft, **When** they open the writing assistant chat panel, **Then** they can have a multi-turn conversation to brainstorm essay prompts, request structural feedback, or ask for guidance relevant to the target opportunity.
3. **Given** a user generating new content sections, **When** they provide a prompt (e.g., "Draft an introductory paragraph highlighting leadership in community service"), **Then** the system generates relevant starter text inserted directly into the document.

---

### User Story 3 - Version History & Document Rollback (Priority: P3)

As an applicant iteratively refining my application documents over days or weeks, I want to view a chronological history of changes and restore previous versions, so that I can review past revisions, compare edits, and recover content that was previously modified.

**Why this priority**: Iterative writing often involves trying different angles or accidentally deleting valuable paragraphs. Version history provides safety and confidence throughout the drafting lifecycle.

**Independent Test**: A user can make multiple edits over time, open the version history timeline, preview an earlier snapshot, and restore that snapshot to the active editor.

**Acceptance Scenarios**:

1. **Given** a document that has undergone multiple editing sessions, **When** the user accesses the version history, **Then** a chronological list of saved versions is displayed with timestamps.
2. **Given** an earlier version selected from the timeline, **When** the user previews it, **Then** the read-only content of that specific version is displayed.
3. **Given** a selected historical version, **When** the user clicks "Restore Version", **Then** the active document's content reverts to that historical state while preserving the restoration as a new version entry.

---

### User Story 4 - Document Finalization & Official Lineage Tracking (Priority: P4)

As an applicant who has completed polishing a draft, I want to finalize the draft into an official application document (PDF) stored in my permanent documents repository, while keeping the full historical lineage intact, so that I can attach the finished document to opportunities while retaining the ability to edit further iterations.

**Why this priority**: Connects the interactive drafting workspace to the platform's core application submission engine, creating a seamless bridge between writing and applying.

**Independent Test**: A user can click "Finalize Document" on a completed draft, and observe that an official, downloadable PDF file is generated and placed into their "My Documents" section, linked back to the draft's version history.

**Acceptance Scenarios**:

1. **Given** a completed draft document, **When** the user selects "Finalize Draft", **Then** the system renders a high-quality, formatted printable document and places it in the user's official documents repository.
2. **Given** a finalized document, **When** the user views the document details, **Then** the system indicates the original draft source and the version milestone from which it was finalized.
3. **Given** an existing uploaded document in the user's repository, **When** the user chooses to create an editable draft from it, **Then** a new draft is spawned with a direct lineage link back to the source document.
4. **Given** a draft document that has been finalized into an official document, **When** the user reopens the draft editor, **Then** the editor is displayed in read-only mode (`FINALIZED`) with an explicit "Unlock / New Revision" button to prevent unintended changes to already-submitted materials.
5. **Given** a user finalizes a revised document (e.g., CV or Statement of Purpose), **When** they confirm the finalization, **Then** the newly generated document is designated as the active, approved version associated with their candidate profile, while past finalized documents remain preserved in repository history.

---

### User Story 5 - Controlled Onboarding via Invitations (Priority: P5)

As an institutional administrator or program manager, I want the ability to onboard specific candidates or cohort members via secure invitation links and manage registration rules, so that the platform can conduct structured pilot cohorts and partner-exclusive programs.

**Why this priority**: Supports controlled rollouts, organizational partnerships, and administrative oversight without disrupting standard user onboarding.

**Independent Test**: An administrator can generate an invitation for a specific email address, and the recipient can use that invitation to register successfully even when public registration is restricted.

**Acceptance Scenarios**:

1. **Given** an administrator generating an invitation, **When** they submit a target email and assigned role, **Then** a unique, time-limited invitation token is issued.
2. **Given** public registration is temporarily paused, **When** an invited user accesses the platform via their unique invitation token, **Then** they are allowed to complete registration and onboarding.
3. **Given** an invitation token that has expired or has already been consumed, **When** a user attempts to register with it, **Then** the system rejects the registration with a clear error message.

---

### Edge Cases

- **Concurrent Window Editing**: What happens when a user opens the same draft in two separate browser tabs and edits both simultaneously? The system must reject stale writes based on version timestamps and notify the user to reload the latest version to prevent silent overwriting.
- **Empty or Incomplete Finalization**: What happens if a user attempts to finalize a draft that has no title or empty body content? The system must block finalization and prompt the user to add content before generating an official document.
- **Account Soft Deletion vs. Document Integrity**: What happens to personal drafts and finalized documents when a user account is deactivated or marked for deletion? The system deactivates the user credentials, while preserving historical document records and version links in a quarantined state without breaking database referential constraints.
- **External Image / Asset Failures**: How does the editor handle embedded images if an asset fails to load or the network drops during editing? The editor preserves a placeholder with the original file reference so content structure is never corrupted.
- **Large Document Export Handling**: What happens if a user finalizes a very lengthy document (e.g., a 30-page research proposal)? The document rendering pipeline must process the file asynchronously or within reasonable timeout bounds, informing the user with a progress indicator until the finalized file is ready in their documents repository.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide private workspaces scoped exclusively to the owning user, ensuring complete data isolation between users.
- **FR-002**: Workspace and document URL identifiers (slugs) MUST be unique only within the scope of the owning user, allowing different users to use identical workspace names.
- **FR-003**: The editor MUST support rich text formatting including headings, bold, italic, ordered/unordered lists, blockquotes, code blocks, hyperlinks, and embedded images.
- **FR-004**: The system MUST automatically persist document changes in the background without requiring explicit user save actions.
- **FR-005**: The system MUST maintain a chronological snapshot of previous document revisions whenever meaningful edits occur.
- **FR-006**: Users MUST be able to preview and revert an active draft to any prior version from its version history.
- **FR-007**: The system MUST provide an integrated AI writing assistant capable of rephrasing, shortening, expanding, and checking grammar on selected text.
- **FR-008**: The system MUST provide a conversational AI assistant panel capable of answering questions, suggesting structural outlines, and generating draft content based on user prompts.
- **FR-009**: Users MUST be able to finalize an editable draft into an official, immutable application document stored in the platform's documents repository. Upon finalization confirmation ("Confirm" / "Apply"), the newly generated document MUST automatically become the active, approved version used in the user's candidate profile, and the draft MUST enter a read-only `FINALIZED` state requiring explicit user action ("Unlock" or "New Revision") to resume editing.
- **FR-010**: The finalization process MUST generate a high-fidelity formatted document that faithfully represents the layout and typography of the editor.
- **FR-011**: Re-finalizing a revised draft MUST generate a new versioned document record in the repository without overwriting past finalized documents, maintaining end-to-end lineage between the draft version history and all associated repository documents.
- **FR-012**: The system MUST support hierarchical document nesting (parent and child documents) within each workspace.
- **FR-013**: The system MUST provide an in-app notification mechanism to alert users to important system events and milestone completions.
- **FR-014**: Administrators MUST be able to issue time-limited, single-use invitation tokens to onboard specific users.
- **FR-015**: The system MUST enforce registration rules, including a configurable global registration toggle and optional email domain allowlisting.
- **FR-016**: The system MUST support organizing drafts with custom workspace tags and bootstrapping new drafts from standardized document blueprints/templates.

---

### Key Entities _(include if feature involves data)_

- **Draft Workspace**: A private project container owned by a single user (e.g., "Chevening Application 2026"), grouping related draft documents and tags.
- **Draft Document (DraftPages)**: A hierarchical rich-text document owned by a user (represented in the database as `DraftPages` / `draft_pages`), containing structured content, status (Draft, In Progress, Finalized, Archived), and parent-child nesting references.
- **Document Version**: An immutable chronological snapshot of a document's content at a specific point in time, recording the revision author, creation timestamp, and whether it represents a finalization milestone.
- **Draft Attachment**: An embedded media file or image associated with a draft document, stored securely in the platform's file storage.
- **Draft Template**: A pre-structured document blueprint (e.g., "Standard Academic CV", "Personal Statement Outline") available to accelerate document creation.
- **Official Document**: An immutable application asset (e.g., finalized PDF, transcript, certificate) residing in the primary user documents repository, ready for opportunity submission.
- **AI Conversation & Message**: A stateful dialogue history between a user and the AI assistant, capturing prompts, responses, and contextual assistance.
- **Invitation**: A secure, tokenized invitation record with expiration date, target email, role assignment, and consumption status.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create a workspace, author a document, and verify auto-save persistence in under 60 seconds from login.
- **SC-002**: Auto-save background operations complete with zero perceptible typing latency or content loss across all editing sessions.
- **SC-003**: AI text transformation requests (grammar, rephrase, expand) return actionable suggestions within 5 seconds under standard network conditions.
- **SC-004**: Document finalization to an official formatted document completes within 10 seconds, immediately appearing in the user's documents repository.
- **SC-005**: 100% of finalized documents maintain visual parity with the editor layout (margins, headings, lists, typography) when viewed as a downloadable document.
- **SC-006**: Zero cross-user data leakage: 100% of draft workspaces and documents are completely inaccessible to any user other than the owner.

---

## Assumptions

- Users access the editor from modern web browsers with standard JavaScript and CSS capabilities.
- The platform's existing user authentication and authorization system will be reused without modification.
- Storage of embedded draft media and finalized documents will leverage the platform's existing cloud object storage infrastructure.
- Collaborative multi-user editing, public comment threads, and unauthenticated public sharing links are explicitly out of scope for this personal draft system.
- Billing and usage quotas for AI writing tools will be managed separately once the platform's subscription and payment subsystem is introduced.
