-- [OMA-W006-T002] Create vector extension and Feature 11 AI memory & proposals tables
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "ai_edit_proposal_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "ai_message_embeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "embedding" vector(384) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_message_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_edit_proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "page_id" UUID NOT NULL,
    "conversation_id" UUID,
    "user_id" UUID NOT NULL,
    "original_text" TEXT NOT NULL,
    "suggested_text" TEXT NOT NULL,
    "explanation" TEXT,
    "status" "ai_edit_proposal_status" NOT NULL DEFAULT 'PENDING',
    "applied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_edit_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_message_embeddings_message_id_key" ON "ai_message_embeddings"("message_id");

-- CreateIndex
CREATE INDEX "ai_message_embeddings_conversation_id_idx" ON "ai_message_embeddings"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_message_embeddings_user_id_idx" ON "ai_message_embeddings"("user_id");

-- CreateIndex
CREATE INDEX "idx_ai_message_embeddings_hnsw" ON "ai_message_embeddings" USING hnsw ("embedding" vector_cosine_ops);

-- CreateIndex
CREATE INDEX "ai_edit_proposals_page_id_idx" ON "ai_edit_proposals"("page_id");

-- CreateIndex
CREATE INDEX "ai_edit_proposals_user_id_idx" ON "ai_edit_proposals"("user_id");

-- CreateIndex
CREATE INDEX "ai_edit_proposals_status_idx" ON "ai_edit_proposals"("status");

-- AddForeignKey
ALTER TABLE "ai_message_embeddings" ADD CONSTRAINT "ai_message_embeddings_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_message_embeddings" ADD CONSTRAINT "ai_message_embeddings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_message_embeddings" ADD CONSTRAINT "ai_message_embeddings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_edit_proposals" ADD CONSTRAINT "ai_edit_proposals_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "draft_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_edit_proposals" ADD CONSTRAINT "ai_edit_proposals_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_edit_proposals" ADD CONSTRAINT "ai_edit_proposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
