-- CreateEnum
CREATE TYPE "DraftPageStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'FINALIZED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "draft_spaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(100),
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "draft_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL,
    "parent_id" UUID,
    "user_id" UUID NOT NULL,
    "document_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(500) NOT NULL,
    "content_json" JSONB,
    "status" "DraftPageStatus" NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "draft_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_page_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "page_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_json" JSONB NOT NULL,
    "is_finalized_snapshot" BOOLEAN NOT NULL DEFAULT false,
    "finalized_document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "page_id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_page_tags" (
    "page_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "draft_page_tags_pkey" PRIMARY KEY ("page_id","tag_id")
);

-- CreateTable
CREATE TABLE "draft_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "content_json" JSONB NOT NULL,
    "category" VARCHAR(100) NOT NULL DEFAULT 'General',
    "icon" VARCHAR(100),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "space_id" UUID,
    "creator_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "draft_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL DEFAULT 'New conversation',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(50) NOT NULL,
    "api_key" TEXT,
    "endpoint" VARCHAR(255),
    "model" VARCHAR(100),
    "deployment" TEXT,
    "api_version" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "role_id" INTEGER,
    "invited_by_id" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "draft_spaces_owner_id_idx" ON "draft_spaces"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "draft_spaces_owner_id_slug_key" ON "draft_spaces"("owner_id", "slug");

-- CreateIndex
CREATE INDEX "draft_pages_space_id_deleted_at_idx" ON "draft_pages"("space_id", "deleted_at");

-- CreateIndex
CREATE INDEX "draft_pages_user_id_idx" ON "draft_pages"("user_id");

-- CreateIndex
CREATE INDEX "draft_pages_document_id_idx" ON "draft_pages"("document_id");

-- CreateIndex
CREATE INDEX "draft_pages_parent_id_idx" ON "draft_pages"("parent_id");

-- CreateIndex
CREATE INDEX "draft_page_versions_page_id_created_at_idx" ON "draft_page_versions"("page_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "draft_page_versions_user_id_idx" ON "draft_page_versions"("user_id");

-- CreateIndex
CREATE INDEX "draft_attachments_page_id_idx" ON "draft_attachments"("page_id");

-- CreateIndex
CREATE INDEX "draft_attachments_uploader_id_idx" ON "draft_attachments"("uploader_id");

-- CreateIndex
CREATE INDEX "draft_tags_space_id_idx" ON "draft_tags"("space_id");

-- CreateIndex
CREATE UNIQUE INDEX "draft_tags_space_id_name_key" ON "draft_tags"("space_id", "name");

-- CreateIndex
CREATE INDEX "draft_templates_space_id_idx" ON "draft_templates"("space_id");

-- CreateIndex
CREATE INDEX "draft_templates_creator_id_idx" ON "draft_templates"("creator_id");

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_updated_at_idx" ON "ai_conversations"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_configs_provider_key" ON "ai_configs"("provider");

-- CreateIndex
CREATE INDEX "ai_configs_is_active_idx" ON "ai_configs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_token_hash_idx" ON "invitations"("token_hash");

-- AddForeignKey
ALTER TABLE "draft_spaces" ADD CONSTRAINT "draft_spaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_pages" ADD CONSTRAINT "draft_pages_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "draft_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_pages" ADD CONSTRAINT "draft_pages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "draft_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_pages" ADD CONSTRAINT "draft_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_pages" ADD CONSTRAINT "draft_pages_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_page_versions" ADD CONSTRAINT "draft_page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "draft_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_page_versions" ADD CONSTRAINT "draft_page_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_attachments" ADD CONSTRAINT "draft_attachments_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "draft_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_attachments" ADD CONSTRAINT "draft_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_tags" ADD CONSTRAINT "draft_tags_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "draft_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_page_tags" ADD CONSTRAINT "draft_page_tags_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "draft_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_page_tags" ADD CONSTRAINT "draft_page_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "draft_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_templates" ADD CONSTRAINT "draft_templates_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "draft_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_templates" ADD CONSTRAINT "draft_templates_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
