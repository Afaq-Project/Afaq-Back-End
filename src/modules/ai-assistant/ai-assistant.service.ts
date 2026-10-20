// [OMA-W006-T004] Conversational memory RAG service and profile grounding
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { AiChatMessage, AiProvider } from './providers/ai-provider.interface';
import { AiMemoryService } from './memory/ai-memory.service';
import { AiProposalsService } from './ai-proposals/ai-proposals.service';
import { AiEditDto, AiEditMode } from './dto/ai-edit.dto';
import { AiGenerateDto } from './dto/ai-generate.dto';
import { AiChatDto } from './dto/ai-chat.dto';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private primaryProvider: AiProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiProvider: OpenAiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly aiMemoryService: AiMemoryService,
    private readonly aiProposalsService: AiProposalsService,
    private readonly configService: ConfigService,
  ) {
    this.primaryProvider = this.openaiProvider;
    this.logger.log(
      'AiAssistantService initialized with OpenAI, Anthropic & Gemini providers',
    );
  }

  getProvider(name?: string): AiProvider {
    if (name === 'anthropic') {
      return this.anthropicProvider;
    }
    if (name === 'gemini') {
      return this.geminiProvider;
    }
    return this.primaryProvider;
  }

  private getSystemPromptForMode(
    mode: AiEditMode,
    instructions?: string,
  ): string {
    const basePrompts: Record<AiEditMode, string> = {
      [AiEditMode.ACADEMIC_TONE]:
        'You are an elite academic scholarship editor. Rewrite the candidate text using sophisticated academic vocabulary, persuasive rhetoric, and impeccable syntax suitable for top-tier international scholarship applications (e.g., Chevening, Fulbright, Rhodes). Return only the revised text without meta-commentary.',
      [AiEditMode.GRAMMAR]:
        "You are an expert English proofreader. Correct all grammatical, orthographic, and punctuation errors while strictly preserving the author's original voice. Return only the corrected text without meta-commentary.",
      [AiEditMode.REPHRASE]:
        'You are an expert writing coach. Rephrase the provided snippet to maximize clarity, stylistic elegance, and narrative impact. Return only the rephrased text without meta-commentary.',
      [AiEditMode.SHORTEN]:
        'You are an expert editor. Condense the text concisely to eliminate filler and redundancy while retaining all essential achievements and facts. Return only the shortened text.',
      [AiEditMode.EXPAND]:
        'You are an academic advisor. Expand the text by adding depth, analytical reasoning, and compelling articulation of candidate motivations. Return only the expanded text.',
      [AiEditMode.SUMMARIZE]:
        'You are an executive summary specialist. Synthesize the core points of the provided text into a concise, high-impact summary. Return only the summary.',
    };

    let prompt = basePrompts[mode] || basePrompts[AiEditMode.REPHRASE];
    if (instructions) {
      prompt += ` Additional candidate instructions: ${instructions}.`;
    }
    return prompt;
  }

  async transformText(
    dto: AiEditDto,
  ): Promise<{ originalText: string; transformedText: string; mode: string }> {
    const systemPrompt = this.getSystemPromptForMode(
      dto.mode,
      dto.instructions,
    );
    const result = await this.primaryProvider.generateText(
      systemPrompt,
      dto.text,
    );

    // [OMA-W004-T001] Return explicit DTO with originalText, transformedText, and mode
    return {
      originalText: dto.text,
      transformedText: result,
      mode: dto.mode,
    };
  }

  async generateContent(
    dto: AiGenerateDto,
  ): Promise<{ content: string; format: string }> {
    let systemPrompt =
      'You are an expert scholarship essay coach and academic writer. Draft the requested content following international scholarship standards. Return high-quality, structured text.';
    if (dto.context) {
      systemPrompt += ` Document context: ${dto.context}`;
    }

    const result = await this.primaryProvider.generateText(
      systemPrompt,
      dto.prompt,
    );

    // [OMA-W004-T001] Return explicit DTO with content and format
    return {
      content: result,
      format: 'markdown',
    };
  }

  // [OMA-W006-T004] Conversational memory RAG service and profile grounding
  async chat(
    userId: string,
    dto: AiChatDto,
  ): Promise<{
    conversationId: string;
    reply: string;
    model: string;
    proposals?: unknown[];
  }> {
    let conversation = dto.conversationId
      ? await this.prisma.aiConversations.findFirst({
          where: { id: dto.conversationId, userId },
        })
      : null;

    if (!conversation) {
      conversation = await this.prisma.aiConversations.create({
        data: {
          userId,
          title: dto.message.slice(0, 50) || 'Scholarship Draft Assistance',
        },
      });
    }

    const history = await this.prisma.aiMessages.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    // Retrieve past conversational memory turns (RAG)
    const memoryTurns = await this.aiMemoryService.findRelevantTurns(
      conversation.id,
      userId,
      dto.message,
      3,
    );

    // Retrieve candidate profile context grounding
    const profileContext = await this.aiMemoryService.getUserContext(userId);

    // Construct grounded system prompt
    let systemPrompt =
      'You are an expert AI scholarship writing copilot. Assist the candidate in drafting and polishing their essays, CVs, and statements.';

    if (profileContext) {
      systemPrompt += `\n\n[Candidate Profile Grounding]\n${profileContext}`;
    }

    if (dto.pageContext) {
      systemPrompt += `\n\n[Current Document Context]\n${dto.pageContext}`;
    }

    if (memoryTurns && memoryTurns.length > 0) {
      const memoryText = memoryTurns
        .map((t) => `(${t.role}): ${t.content}`)
        .join('\n');
      systemPrompt += `\n\n[Relevant Conversation History Memory]\n${memoryText}`;
    }

    const messages: AiChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...history.map((h) => ({
        role: h.role as 'system' | 'user' | 'assistant',
        content: h.content,
      })),
      {
        role: 'user',
        content: dto.message,
      },
    ];

    const userMessage = await this.prisma.aiMessages.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: dto.message,
      },
    });

    // Send to LLM provider with tool calling
    const geminiResponse = this.geminiProvider.chatWithTools
      ? await this.geminiProvider.chatWithTools(messages)
      : {
          reply: await this.geminiProvider.chat(messages),
          toolCalls: [],
        };
    const assistantReply = geminiResponse.reply;

    // Handle tool call: propose_document_edit
    const proposals: unknown[] = [];
    if (geminiResponse.toolCalls && geminiResponse.toolCalls.length > 0) {
      for (const call of geminiResponse.toolCalls) {
        if (call.name === 'propose_document_edit' && call.args) {
          try {
            const pageId =
              typeof call.args.pageId === 'string' ? call.args.pageId : '';
            const originalText =
              typeof call.args.originalText === 'string'
                ? call.args.originalText
                : '';
            const suggestedText =
              typeof call.args.suggestedText === 'string'
                ? call.args.suggestedText
                : '';
            const explanation =
              typeof call.args.explanation === 'string'
                ? call.args.explanation
                : undefined;

            if (pageId && originalText && suggestedText) {
              const proposal = await this.aiProposalsService.createProposal(
                userId,
                pageId,
                conversation.id,
                originalText,
                suggestedText,
                explanation,
              );
              proposals.push(proposal);
            }
          } catch (toolErr) {
            this.logger.error(
              'Failed to create edit proposal from tool call',
              toolErr,
            );
          }
        }
      }
    }

    const assistantMessage = await this.prisma.aiMessages.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantReply,
        sources:
          proposals.length > 0
            ? (proposals as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });

    await this.prisma.aiConversations.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // Fire-and-forget asynchronous memory indexing
    this.aiMemoryService
      .indexTurn(userMessage.id, conversation.id, userId, dto.message)
      .catch((err) =>
        this.logger.error(
          `Failed background index turn for user message ${userMessage.id}`,
          err,
        ),
      );

    this.aiMemoryService
      .indexTurn(assistantMessage.id, conversation.id, userId, assistantReply)
      .catch((err) =>
        this.logger.error(
          `Failed background index turn for assistant message ${assistantMessage.id}`,
          err,
        ),
      );

    const modelName =
      this.configService.get<string>('GEMINI_MODEL') ||
      process.env.GEMINI_MODEL ||
      'gemini-3.5-flash-lite';

    return {
      conversationId: conversation.id,
      reply: assistantReply,
      model: modelName,
      ...(proposals.length > 0 ? { proposals } : {}),
    };
  }
}
