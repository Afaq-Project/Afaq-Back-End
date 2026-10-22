# Feature Specification: AI Assistant Architecture & Conversational Memory RAG

**Feature Branch**: `011-ai-assistant-rag`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Alright, now create the specifications for Feature 11, which concerns the new AI assistant architecture and the RAG (Retrieval-Augmented Generation) system."

## Clarifications

### Session 2026-10-18

- Q: Should the conversational AI copilot deliver responses via real-time streaming (Server-Sent Events) or as standard synchronous HTTP responses? → A: Option B — Standard Synchronous REST (Wait for full completion and return a single HTTP 200 OK JSON envelope).
- Q: How should staged document edit proposals be tracked and applied when a user decides to accept or reject them? → A: Option B — Persistent Proposal Entity in a dedicated database table (AiEditProposals) with explicit state transitions (PENDING, ACCEPTED, REJECTED) and dedicated accept/reject endpoints.
- Q: Which Google Gemini model should be configured as the primary default model in the application configuration? → A: Option A — `gemini-3.5-flash-lite` as initial default, with strict requirement that the model name MUST be configurable via the `.env` file (`GEMINI_MODEL`).
- Q: When should new conversation turns be embedded and indexed into the vector memory database? → A: Option A — Asynchronous Background Processing (send response to user immediately, then compute and persist embedding asynchronously without blocking).
- Q: How should the candidate's existing platform profile data (education history, test scores, special statuses) be supplied to the AI copilot? → A: Option A — Deterministic Structured System Context (fetch candidate profile summary and inject directly into system prompt for 100% factual accuracy).

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Conversational Writing Copilot with Long-Term Memory (Priority: P1)

As a scholarship applicant drafting my application materials over multiple working sessions, I want an interactive conversational AI copilot that remembers facts, past discussions, and personal constraints mentioned earlier in the conversation, so that I do not have to repeatedly re-explain my background, goals, or instructions as the conversation grows.

**Why this priority**: Long-term conversational coherence is the primary foundation for a trustworthy writing partner. Without memory, applicants get frustrated having to repeat earlier details (such as their GPA, target universities, or preferred essay structure) once conversations exceed a few messages.

**Independent Test**: Can be tested independently by having a multi-turn conversation where personal facts are shared in early turns (e.g., "I earned a degree in Robotics and won a hackathon in 2024"), followed by unrelated queries, and finally asking a synthesizing question (e.g., "Draft an introduction highlighting my tech achievements"). The copilot must accurately recall and incorporate the earlier facts.

**Acceptance Scenarios**:

1. **Given** a user is on turn 15 of an active conversation where they mentioned their target scholarship (e.g., "Chevening") in turn 2, **When** they ask "What tone should I use for my leadership essay?", **Then** the copilot provides advice specifically tailored to the previously stated scholarship without asking the user to repeat it.
2. **Given** an ongoing conversation with extensive discussion history, **When** the user sends a new message, **Then** the response latency remains snappy and consistent, retrieving relevant past topics without exceeding the system's token budget.
3. **Given** a new or empty conversation, **When** the user sends their first inquiry, **Then** the copilot responds smoothly using immediate context without requiring any historical retrieval.

---

### User Story 2 - Delegated File-Editing Sub-Agent with Staged Proposals (Priority: P2)

As a candidate reviewing a draft document in the editor, I want the conversational assistant to directly propose surgical edits to specific paragraphs or sections upon my request, presenting the changes as a staged preview/diff that I can review, accept, or reject, without cluttering the chat with thousands of words of raw document code.

**Why this priority**: Users want the convenience of natural language ("improve paragraph 3 to highlight my leadership") combined with the safety of controlled editing. Direct automated overwriting without user review causes anxiety and data loss; staged proposals provide complete user agency and safety.

**Independent Test**: Can be tested independently by requesting an edit on a sample text paragraph from the chat interface. The system must return an interactive proposal object displaying the original snippet, the proposed revision, and an explanation of changes, allowing the user to accept the edit into the document or reject it.

**Acceptance Scenarios**:

1. **Given** an open draft document with multiple sections, **When** the user tells the chat copilot "Rewrite the second paragraph to sound more academic and confident", **Then** the copilot delegates the task to a specialized editing worker and returns an interactive edit proposal containing the original text, the suggested text, and a concise rationale.
2. **Given** a generated edit proposal, **When** the user confirms/accepts the proposal, **Then** the document content updates with the new text, and an automatic version snapshot is preserved for instant rollback.
3. **Given** a generated edit proposal, **When** the user rejects the proposal or requests adjustments ("Make it slightly shorter"), **Then** the document remains untouched and the assistant generates an updated proposal reflecting the feedback.
4. **Given** an active editing operation, **Then** the sub-agent receives only the target snippet, surrounding sentence boundaries, and explicit task instructions, keeping the main conversation context clean.

---

### User Story 3 - Provider-Agnostic Model Routing with Local Free Embeddings (Priority: P3)

As a platform operator and developer, I want the system to utilize local, in-process vector embedding generation at zero external API cost, and support flexible cloud LLM providers (including Google Gemini and OpenAI), so that the platform remains cost-effective, high-performing, and resilient against single-vendor lock-in.

**Why this priority**: Sustainable operational costs and vendor flexibility are vital. Generating embeddings locally eliminates external billing and network latency for memory lookups, while provider abstraction enables swapping or upgrading models through simple configuration.

**Independent Test**: Can be tested independently by submitting text for vector embedding and verifying that vectors are produced locally in-memory without external HTTP calls. Similarly, verifying that switching the configured model provider routes requests to the intended provider API.

**Acceptance Scenarios**:

1. **Given** a user message or conversation turn to be indexed, **When** the embedding process executes, **Then** a 384-dimensional vector is generated entirely in-process within 25 milliseconds with zero external API calls.
2. **Given** a configured provider environment variable, **When** the application starts, **Then** the system initializes the corresponding provider client (e.g., Google Gemini or OpenAI) and validates credentials on initial request.
3. **Given** an unavailable or unconfigured provider key, **When** an assistant request is initiated, **Then** the system gracefully falls back to deterministic local mock responses without crashing or throwing unhandled server errors.

---

### Edge Cases

- **Extremely long conversation (100+ turns)**: System must retrieve the most semantically relevant historical snippets along with the immediate 3-4 recent turns, guaranteeing that context bounds are never exceeded regardless of conversation length.
- **Ambiguous edit targets**: If the user asks "Rewrite the paragraph" in a document containing ten paragraphs without specifying which one, the assistant must ask for clarification or propose an edit based on the currently selected/focused editor text.
- **Malformed or non-standard document formatting**: The editing sub-agent must safely handle plain text, rich text marks, code snippets, or bulleted lists without corrupting document structures or throwing parsing exceptions.
- **Rapid successive messages**: If a user submits multiple questions in rapid succession, background memory embedding must process asynchronously without blocking the primary chat response.
- **Empty or low-similarity retrieval**: If no past conversation turns meet the semantic relevance threshold, the system must omit memory injection and rely solely on the recent conversation buffer.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide an interactive conversational AI interface via standard synchronous REST HTTP endpoints returning complete responses and staged proposals within unified JSON envelopes.
- **FR-002**: The system MUST maintain long-term conversational memory by generating vector embeddings for conversation turns asynchronously in the background following the HTTP response, storing them in the platform's vector-enabled database without blocking user response latency.
- **FR-003**: The system MUST compute vector embeddings in-process using an embedded open-source model, requiring zero external API calls or third-party vector service fees.
- **FR-004**: Upon receiving a user message in an existing conversation, the system MUST retrieve the most semantically relevant historical turns and inject them into the active context alongside the immediate recent dialogue buffer.
- **FR-005**: The system MUST enforce tenant isolation on memory retrieval, ensuring that semantic queries only search within the authenticated user's own conversation records.
- **FR-006**: The primary chat agent MUST be equipped with tool-calling capabilities that allow it to recognize when a user request requires document modifications.
- **FR-007**: When document modification is detected, the system MUST delegate the text transformation to an isolated, stateless file-editing sub-agent.
- **FR-008**: The file-editing sub-agent MUST operate with a focused, zero-history context window, receiving only the target text snippet, surrounding boundary context, and explicit transformation instructions.
- **FR-009**: The file-editing sub-agent MUST return structured proposals containing the original snippet, suggested snippet, change summary, and operation mode (e.g., academic tone, grammar fix, rephrase, expand, shorten).
- **FR-010**: The system MUST persist edit proposals in a dedicated database entity (`AiEditProposal`) with a defined lifecycle (`PENDING`, `ACCEPTED`, `REJECTED`) and expose explicit endpoints for users to accept or reject them.
- **FR-011**: When a user accepts a proposal via the acceptance endpoint, the system MUST automatically create a draft version snapshot before updating the draft page content, and transition the proposal status to `ACCEPTED`.
- **FR-012**: The system MUST support provider abstraction for underlying language models, with native integration for Google Gemini, loading the target model strictly from the `.env` file configuration (e.g., `GEMINI_MODEL`, defaulting to `gemini-3.5-flash-lite`).
- **FR-013**: The system MUST provide graceful fallback behavior when external AI credentials are unconfigured or temporarily unreachable.
- **FR-014**: All AI endpoints MUST enforce authentication and rate limiting to prevent denial-of-service or credential exhaustion.
- **FR-015**: Input text and prompts submitted to AI endpoints MUST be validated with maximum length bounds (up to 50,000 characters) to prevent memory exhaustion attacks.
- **FR-016**: The system MUST fetch the candidate's active platform profile summary (including degree, GPA, test scores, special statuses, and languages) and inject it deterministically into the system prompt context to guarantee 100% factual accuracy on user credentials.

---

### Key Entities

- **AiConversation**: Represents a multi-turn chat session between a user and the assistant, containing metadata such as title, owner user ID, timestamps, and linked draft page context.
- **AiMessage**: An individual conversational turn (user, assistant, or system prompt), storing the textual content, role, sequence, and creation timestamp.
- **AiMessageEmbedding**: A vector representation of an individual message or exchange, storing the 384-dimensional vector, reference to the message and conversation, and tenant ownership ID for vector search.
- **AiEditProposal**: A persistent database entity storing page ID, user ID, original snippet, proposed snippet, operation mode, explanation, and lifecycle status (`PENDING`, `ACCEPTED`, `REJECTED`).
- **DraftSnapshot**: An immutable historical snapshot of a draft page captured before applying accepted AI proposals, storing complete document state for rollback.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In conversations spanning more than 20 turns, the assistant successfully recalls relevant facts mentioned in the first 5 turns in at least 95% of test queries.
- **SC-002**: Local vector embedding generation completes in under 30 milliseconds on standard server CPU compute without external network dependencies.
- **SC-003**: Semantic context retrieval query latency in the database executes in under 20 milliseconds using vector indexing.
- **SC-004**: Document editing requests yield a structured proposal within standard model generation time (under 3 seconds for typical paragraphs), without leaking unformatted diffs or AST syntax into the chat response.
- **SC-005**: 100% of accepted edit proposals generate an immutable document version snapshot prior to content mutation.
- **SC-006**: The total prompt token size for the primary chat agent remains bounded and stable across 50+ turns, achieving at least a 60% token reduction compared to sending complete unpruned conversation transcripts.
- **SC-007**: 0% accidental document overwrites: No document content is modified in the database until the candidate explicitly accepts the proposal.

---

## Assumptions

- **Database Environment**: The hosting PostgreSQL database (Supabase) has the native `vector` extension enabled for storing and querying 384-dimensional embeddings.
- **Single-Document Scope for Sub-Agent**: The file-editing sub-agent modifies one section or document at a time; cross-document batch edits are out of scope for this version.
- **Language Scope**: Initial embedding and editing capabilities target English text, which represents the standard language for international scholarship applications (Chevening, Fulbright, Rhodes).
- **User Interface Capability**: The frontend editor interface supports rendering interactive proposal/diff cards within the chat sidebar and provides "Accept" and "Reject" actions.
- **External Model Access**: The user configures valid API credentials for their chosen cloud model provider (e.g., Google Gemini); fallback mode handles unconfigured states during development and testing.
