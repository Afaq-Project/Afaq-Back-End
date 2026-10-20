# Levora Features 10 & 11 • Front-End Preview UI

This directory contains the standalone demonstration user interface built to showcase and interact with **Features 10 & 11** of the Levora Platform.

## Features Demonstrated

1. **Automatic Connection & Authentication**:
   - Launches with an "Authenticating..." status overlay.
   - Automatically authenticates against `http://localhost:3000/api/v1/auth/login` using credentials from the Postman collection.
   - Allows switching between **Candidate** (`candidate@levora.app`) and **System Admin** (`admin@levora.app`).

2. **Draft Workspaces (`/drafts/spaces`)**:
   - Workspace creation, listing, document hierarchy tree, and cascade deletion.

3. **In-Editor Experience & Auto-Save (`/drafts/spaces/:slug/pages`)**:
   - TipTap/ProseMirror AST-compatible editor.
   - Real-time debounced auto-save (1,500ms) with word count, reading time, and status lifecycle badges.

4. **PDF Finalization & Lock Lifecycle (`/drafts/pages/:id`)**:
   - One-click compilation of TipTap AST to official application PDF via Node.js `pdfmake`.
   - Editing locks upon finalization (`409 Conflict` on edit attempt).
   - "Unlock Draft" action restores editing capabilities.

5. **Version Snapshots & Rollback (`/drafts/pages/:id/versions`)**:
   - Chronological snapshots list.
   - One-click rollback restoring historical AST content.

6. **Embedded Media & Attachments (`/drafts/spaces/.../attachments`)**:
   - File upload dropzone, size and MIME type handling.
   - Presigned download URLs and file deletion.

7. **Workspace Color-Coded Tags (`/drafts/spaces/:slug/tags`)**:
   - Tag creation, assignment to pages, and deletion.

8. **Draft Templates Library (`/drafts/templates`)**:
   - Default academic templates and private user templates.
   - Instantiate new draft pages from pre-configured layouts.

9. **In-Editor AI Writing Assistant & Staged Proposals (`/editor/ai`)**:
   - Floating text selection bar: Academic Tone, Rephrase, Grammar Polish, Shorten, Expand.
   - Quick Starter Generator (Prompt & Context).
   - Conversational Memory RAG Copilot Chat powered by Google Gemini and user profile grounding.
   - **Staged AI Edit Proposals**: Visual diff cards (red strikethrough original, green highlight suggested text) with Accept (AST safe replacement) and Reject actions.

10. **Universal Notifications Center (`/notifications`)**:
    - Unread badge counter, notification drawer, mark as read, and bulk mark all as read.

11. **Controlled Onboarding via Invitations (`/auth`)**:
    - Admin invitation issuance with SHA-256 token hashing.
    - Public invitation token validation and registration.

---

## How to Run

Because `http://localhost:4200` is pre-configured in `CORS_ORIGINS`, run the UI on port 4200:

```bash
# Using Python
python3 -m http.server 4200 --directory demo-ui

# Or using npx serve
npx serve -p 4200 demo-ui
```

Then open your browser at:
👉 **[http://localhost:4200](http://localhost:4200)**
