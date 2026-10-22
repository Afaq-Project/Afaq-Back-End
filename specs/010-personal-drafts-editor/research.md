# Technical Research & Architectural Decisions: Personal Drafts & Document Editor

**Feature Branch**: `010-personal-drafts-editor`  
**Date**: 2026-10-17  
**Status**: Completed  

---

## Decision 1: Rich Text Content Storage & Auto-Save Transport

### Decision
Store rich-text documents as structured **TipTap/ProseMirror JSON** (`content_json: Json` in PostgreSQL) and use standard **HTTP `PATCH /api/v1/drafts/spaces/:slug/pages/:pageId`** for auto-saving with debouncing on the client side. WebSockets and CRDTs are completely eliminated.

### Rationale
- **Zero WebSocket Overhead**: Personal drafting does not involve simultaneous multi-cursor collaboration. WebSockets (`hocuspocus`, `yjs`) add unnecessary server memory, connection state tracking, and deployment complexity.
- **Structured Schema Safety**: ProseMirror JSON represents documents as an Abstract Syntax Tree (nodes, marks, attributes), preventing arbitrary HTML injection (XSS) and allowing reliable server-side validation and rendering.
- **REST Reliability**: Standard HTTP PATCH requests with JWT authorization seamlessly leverage existing authentication guards, rate limiters, and error filters in NestJS.

### Alternatives Considered
- *Yjs CRDT with Binary State Vector (`yjsState`)*: Rejected because real-time multi-user typing is not needed for private candidate drafts, and storing large binary blobs in PostgreSQL causes bloat.
- *Raw HTML Strings*: Rejected due to high XSS vulnerability risk and lack of structural manipulation when sending text segments to AI models.
- *Markdown Only*: Rejected because candidates need rich layout controls (tables, callout boxes, text color, aligned margins) that standard markdown cannot natively express.

---

## Decision 2: High-Fidelity PDF Generation Engine

### Decision
Use **`puppeteer-core` combined with `@sparticuz/chromium`** to render TipTap JSON into HTML via `@tiptap/html` and export pixel-perfect, printable PDFs.

### Rationale
- **Visual Parity**: Application materials (CVs, Statements of Purpose) require strict aesthetic layout parity (margins, fonts, styling, page breaks) matching what the candidate sees in the editor.
- **Serverless & Container Ready**: `@sparticuz/chromium` provides a lightweight, pre-compiled headless Chromium binary designed specifically to run inside Linux Docker containers and serverless environments without requiring system-level GUI dependencies.
- **CSS-Driven Design**: The PDF layout can be styled using standard CSS `@media print` rules, headers/footers, and page-break controls.

### Alternatives Considered
- *`pdfkit`*: Rejected because building complex formatted layouts programmatically in JavaScript is tedious, error-prone, and cannot reuse the CSS styling of the rich-text editor.
- *`wkhtmltopdf`*: Rejected because it relies on an obsolete, unmaintained WebKit engine with poor modern CSS/font support.
- *External Cloud PDF Services*: Rejected to eliminate external recurring costs and maintain candidate document privacy locally within the backend perimeter.

---

## Decision 3: Document Lineage & Base Table Preservation

### Decision
Maintain document lineage by placing an optional foreign key `documentId: String?` on `DraftPages`, pointing to Afaq's existing `Documents` table (`onDelete: SetNull`), and adding snapshot tracking fields on `DraftPageVersions` (`isFinalizedSnapshot: Boolean`, `finalizedDocumentId: String?`).

### Rationale
- **Zero Base Table Mutation**: Strictly respects the immutable mandate of Afaq's existing 32 tables. The `documents` table in PostgreSQL receives no new database columns.
- **Bidirectional Lineage**: When a draft is created from an uploaded document, `draft_pages.document_id` links to the source. When a draft is finalized into an official document, the generated `documents` record is linked, and the version snapshot records `finalizedDocumentId`.
- **Integrity on Deletion**: Setting `onDelete: SetNull` ensures that if a historical document is purged, the draft and its editing history remain intact.

### Alternatives Considered
- *Adding `draftId` column to `documents` table*: Rejected because modifying Afaq's base tables violates the project constitution.
- *Separate Mapping Table (`draft_document_links`)*: Rejected as over-engineering for a straightforward 1:N lineage relation that fits naturally inside the draft models.

---

## Decision 4: User-Scoped Workspaces & Slug Collisions

### Decision
Enforce namespace uniqueness strictly per user by applying a composite unique index:
`@@unique([ownerId, slug])` on `DraftSpaces`.

### Rationale
- **Collision Immunity**: Different candidates frequently use common workspace names (e.g., `personal-statements`, `cv`, `scholarships`). A global slug constraint would fail with 409 Conflict as soon as a second user tried to use a common name.
- **Clean URLs**: URLs are resolved contextually via `req.user.id` or user scope (e.g., `/api/v1/drafts/spaces/scholarships/pages/...`).

### Alternatives Considered
- *Global Unique Slug with Random Hash Suffix (e.g., `cv-8f3a9`)*: Rejected because it creates ugly, non-deterministic URLs and is unnecessary for private, non-public resources.

---

## Decision 5: Post-Finalization Locking & Profile Activation

### Decision
Upon finalization confirmation ("Confirm" / "Apply"):
1. The draft status transitions to `FINALIZED` (read-only mode in the UI).
2. The newly generated PDF is stored in `documents` and designated as the **approved, active version** for the candidate's profile.
3. To resume editing, the candidate must click "Unlock / New Revision", which resets the draft to `IN_PROGRESS` and prepares a new version milestone. Subsequent finalizations create new versioned document entries without overwriting previous ones.

### Rationale
- **Submission Protection**: Prevents accidental edits to materials that have already been attached to submitted opportunities.
- **Profile Synchronization**: Ensures the candidate's active profile automatically points to their latest polished resume or statement without requiring manual reassignment.

### Alternatives Considered
- *Immediate Open Editing*: Rejected because candidates could accidentally overwrite a finalized document while assuming it was safely locked.
- *Cloning into a Separate Draft on Every Edit*: Rejected because it rapidly litters the workspace with duplicate documents (`CV Copy 1`, `CV Copy 2`).

---

## Decision 6: In-Editor AI Writing Assistant Architecture

### Decision
Implement an `AiAssistantModule` utilizing an abstract `AiProvider` interface with adapters for **OpenAI** (GPT-4o / GPT-4o-mini) and **Anthropic** (Claude 3.5 Sonnet). Usage limits and subscription gates are deferred until Afaq's billing module is activated.

### Rationale
- **Provider Redundancy**: An abstract provider gateway prevents vendor lock-in and allows seamless switching if an external API experiences downtime.
- **Structured Prompts**: Specialized system prompts for academic and professional application materials (e.g., Chevening, Fulbright, Erasmus formats) provide substantially better quality than generic chatbots.

### Alternatives Considered
- *Self-hosted Open-Source Models*: Rejected due to high GPU infrastructure costs and operational maintenance during current platform stage.
