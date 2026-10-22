# Research: AI Assistant Architecture & Conversational Memory RAG

**Feature**: `011-ai-assistant-rag`  
**Date**: 2026-10-18  
**Status**: Completed  

---

## 1. Google Gemini Cloud LLM Provider & Tool Calling

### Decision
Implement a dedicated `GeminiProvider` implementing `AiProvider` in `src/modules/ai-assistant/providers/gemini.provider.ts`. The provider will communicate with Google's Generative Language API (`v1beta`) using HTTPS REST endpoints with native tool calling (`functionDeclarations`), reading credentials and model choices dynamically from environment variables (`GEMINI_API_KEY` and `GEMINI_MODEL`, defaulting to `gemini-3.5-flash-lite`).

### Rationale
- **Proven Compatibility**: The user's Gemini API key was verified live against Google's API, successfully returning completions with `gemini-3.5-flash-lite`, `gemini-3.8-flash`, and `gemini-flash-lite-latest`.
- **Tool Calling (Function Calling)**: Google Gemini natively supports function calling via the `tools` parameter in `generateContent`. When the user requests an edit, Gemini emits a structured `functionCall` object specifying `name: "propose_document_edit"` and typed arguments (`originalText`, `suggestedText`, `instruction`, `mode`), allowing the backend to deterministically route editing tasks without fragile regex parsing.
- **Dynamic Model Selection**: By loading `GEMINI_MODEL` from `process.env` / `ConfigService`, operators can toggle between `gemini-3.5-flash-lite` (low latency, high throughput) and `gemini-3.8-flash` or `gemini-2.5-pro` (deep reasoning) without code redeployment.

### Alternatives Considered
- *Using `@google/genai` or `@google/generative-ai` SDK*: Adding an external Google SDK package increases bundle size and introduces potential dependency conflicts. Using Node.js standard `fetch` with Google's clean REST API (`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`) is zero-dependency, lightweight, and fully resilient.
- *OpenAI-compatible proxy endpoint for Gemini*: Google offers an OpenAI-compatible endpoint, but native Gemini REST endpoints provide direct support for system instructions, safety settings, and standard Google error semantics.

---

## 2. In-Process Free Vector Embeddings (`@xenova/transformers`)

### Decision
Generate vector embeddings 100% in-process within Node.js using `@xenova/transformers` (Transformers.js) running the open-source `Xenova/all-MiniLM-L6-v2` model in ONNX Runtime.

### Rationale
- **$0 Cost & Zero API Calls**: Generates dense embeddings locally on CPU without external API keys, rate limits, or billing.
- **Latency & Throughput**: `all-MiniLM-L6-v2` generates a 384-dimensional vector in ~10–20 milliseconds on standard CPU cores.
- **Memory Footprint**: The quantized ONNX model requires only ~23MB of disk space and ~60MB of RAM, which is loaded once as a NestJS singleton service (`LocalEmbeddingService`).
- **Semantic Quality**: `all-MiniLM-L6-v2` is a standard benchmark model for semantic search and conversational retrieval, offering cosine similarity accuracy on par with commercial embedding models for conversational turn matching.

### Alternatives Considered
- *OpenAI `text-embedding-3-small`*: Requires an OpenAI API key, charges per token, and introduces external network latency on every conversational turn.
- *Python Core Service delegation*: Moving embedding generation to the external Python service would introduce inter-service HTTP hops and serialization overhead for small conversational snippets. In-process Node.js embedding keeps the AI Assistant self-contained.

---

## 3. Vector Storage & Semantic Search in Supabase (`pgvector`)

### Decision
Store conversation turn embeddings in an `ai_message_embeddings` table in Supabase PostgreSQL using the native `vector(384)` data type and an HNSW (Hierarchical Navigable Small World) index with cosine distance (`vector_cosine_ops`).

### Rationale
- **Zero Infrastructure Overhead**: Supabase comes with `pgvector` pre-installed and activated.
- **HNSW Indexing**: HNSW provides sub-millisecond approximate nearest neighbor (ANN) retrieval with high recall:
  ```sql
  CREATE INDEX idx_ai_message_embeddings_hnsw 
  ON ai_message_embeddings USING hnsw (embedding vector_cosine_ops);
  ```
- **Prisma Support**: Prisma 6.x supports PostgreSQL extensions via `previewFeatures = ["postgresqlExtensions"]` and the `Unsupported("vector(384)")` column definition. Vector similarity queries are executed via raw Prisma SQL (`$queryRaw`):
  ```sql
  SELECT m.id, m.content, m.role, 1 - (e.embedding <=> $1::vector) AS similarity
  FROM ai_messages m
  JOIN ai_message_embeddings e ON e.message_id = m.id
  WHERE m.conversation_id = $2
    AND m.id NOT IN ($recentMessageIds)
  ORDER BY e.embedding <=> $1::vector
  LIMIT 2;
  ```

### Alternatives Considered
- *Pinecone / Qdrant / Weaviate*: External vector databases add architectural complexity, network latency, separate authentication, and monthly hosting costs.
- *Full-text search (`tsvector`)*: PostgreSQL full-text search matches exact keywords or stems, but fails to capture semantic synonyms (e.g. matching "undergraduate studies" with "bachelor's degree").

---

## 4. Asynchronous Ingestion & Non-Blocking Response Pipeline

### Decision
Implement conversational memory indexing asynchronously: when a user sends a message, the system stores the raw message, queries past memories, calls Gemini, and returns the complete HTTP `200 OK` response to the user. The embedding generation and vector storage for the new turn run in a non-blocking detached background promise.

### Rationale
- **Zero User-Perceived Latency**: The candidate does not wait an extra 20–30ms for embedding generation; their chat response returns as fast as the LLM finishes.
- **Fault Isolation**: If local embedding generation temporarily encounters a resource spike, the primary conversational chat response is unaffected.
- **Order of Operations**:
  1. Receive incoming user query.
  2. Embed query synchronously (~15ms) to retrieve past memories.
  3. Query Supabase for top 2 similar historical turns.
  4. Fetch candidate profile summary (GPA, degree, test scores).
  5. Assemble prompt: System instructions + Profile context + Retrieved memories + Last 3 recent turns.
  6. Generate response via `GeminiProvider`.
  7. Return HTTP `200 OK` to user.
  8. *Background*: Embed user message and assistant reply, persisting vectors to `ai_message_embeddings`.

---

## 5. Persistent Proposal Entity & Controlled Document Mutation

### Decision
Model staged document modifications as a persistent database entity (`AiEditProposal`) with states `PENDING`, `ACCEPTED`, `REJECTED`, managed via dedicated endpoints (`POST /editor/ai/proposals/:id/accept` and `POST /editor/ai/proposals/:id/reject`).

### Rationale
- **Auditability & Traceability**: Candidates and administrators can inspect the exact history of AI recommendations and decisions.
- **Atomic Rollback Guarantee**: When a user accepts a proposal, the transaction:
  1. Invokes `DraftVersionsService.createSnapshot()` to create an immutable rollback checkpoint.
  2. Mutates the targeted draft page content in `DraftPages`.
  3. Transitions proposal status to `ACCEPTED`.
- **Zero Accidental Overwriting**: The AI Assistant never directly modifies user drafts; it only generates proposals that require explicit user confirmation.

---

## 6. Deterministic Candidate Profile Context Assembly

### Decision
Inject candidate credentials (educations, GPA, test scores, languages, special statuses) into the system prompt as a compact, structured text block fetched directly from PostgreSQL.

### Rationale
- **100% Precision**: Facts like IELTS 7.5, GPA 3.85, or Bachelor in Computer Science are critical for scholarship essays. Semantic vector retrieval risks missing exact structured fields if embeddings are chunked.
- **Compact Token Size**: A full candidate profile summary is typically only 150–250 tokens, which easily fits within Gemini's context window without noticeable token or latency overhead.
- **Zero Hallucination**: The AI writing copilot is grounded in verified candidate records, allowing it to seamlessly tailor personal statements without asking the applicant for their credentials.
