// [OMA-W006-T003] Register Gemini, memory, and proposals services in AiAssistantModule
// [OMA-W006-T007] Verification gates, benchmarks, Swagger docs, Postman sync, and sign-off
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { DraftsModule } from '../drafts/drafts.module';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { LocalEmbeddingService } from './memory/local-embedding.service';
import { AiMemoryService } from './memory/ai-memory.service';
import { AiProposalsService } from './ai-proposals/ai-proposals.service';
import { AiAssistantService } from './ai-assistant.service';
// [OMA-W009-T003] Register AiConversationsController
import { AiConversationsController } from './ai-conversations/ai-conversations.controller';
import { AiTransformController } from './ai-transform/ai-transform.controller';
import { AiChatController } from './ai-chat/ai-chat.controller';
import { AiProposalsController } from './ai-proposals/ai-proposals.controller';

@Module({
  imports: [ConfigModule, PrismaModule, DraftsModule],
  controllers: [
    AiTransformController,
    AiChatController,
    AiProposalsController,
    AiConversationsController,
  ],
  providers: [
    OpenAiProvider,
    AnthropicProvider,
    GeminiProvider,
    LocalEmbeddingService,
    AiMemoryService,
    AiProposalsService,
    AiAssistantService,
  ],
  exports: [
    AiAssistantService,
    AiMemoryService,
    AiProposalsService,
    GeminiProvider,
  ],
})
export class AiAssistantModule {}
