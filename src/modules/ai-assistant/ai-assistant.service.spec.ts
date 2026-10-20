// [OMA-W002-T006] AiAssistantService Spec
// [OMA-W006-T006] Test AI assistant chat with memory RAG and tool-calling proposal dispatch
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiAssistantService } from './ai-assistant.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { AiMemoryService } from './memory/ai-memory.service';
import { AiProposalsService } from './ai-proposals/ai-proposals.service';
import { AiEditMode } from './dto/ai-edit.dto';

describe('AiAssistantService', () => {
  let service: AiAssistantService;
  let mockOpenAiProvider: {
    generateText: jest.Mock;
    chat: jest.Mock;
    providerName: string;
  };
  let mockAnthropicProvider: {
    generateText: jest.Mock;
    chat: jest.Mock;
    providerName: string;
  };
  let mockGeminiProvider: {
    generateText: jest.Mock;
    chat: jest.Mock;
    chatWithTools: jest.Mock;
    providerName: string;
  };
  let mockAiMemoryService: {
    findRelevantTurns: jest.Mock;
    getUserContext: jest.Mock;
    indexTurn: jest.Mock;
  };
  let mockAiProposalsService: {
    createProposal: jest.Mock;
  };
  let mockConfigService: {
    get: jest.Mock;
  };

  const mockPrisma = {
    aiConversations: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aiMessages: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    mockOpenAiProvider = {
      providerName: 'openai',
      generateText: jest.fn().mockResolvedValue('Polished academic statement'),
      chat: jest
        .fn()
        .mockResolvedValue(
          'I recommend highlighting your leadership experience.',
        ),
    };

    mockAnthropicProvider = {
      providerName: 'anthropic',
      generateText: jest.fn().mockResolvedValue('Anthropic generated text'),
      chat: jest.fn().mockResolvedValue('Anthropic chat response'),
    };

    mockGeminiProvider = {
      providerName: 'gemini',
      generateText: jest.fn().mockResolvedValue('Gemini generated text'),
      chat: jest.fn().mockResolvedValue('Gemini chat response'),
      chatWithTools: jest.fn().mockResolvedValue({
        reply: 'Structure your essay using the STAR method.',
        toolCalls: [],
      }),
    };

    mockAiMemoryService = {
      findRelevantTurns: jest.fn().mockResolvedValue([]),
      getUserContext: jest.fn().mockResolvedValue(''),
      indexTurn: jest.fn().mockResolvedValue(undefined),
    };

    mockAiProposalsService = {
      createProposal: jest.fn().mockResolvedValue({ id: 'prop-1' }),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'GEMINI_MODEL') {
          return 'gemini-3.5-flash-lite';
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAssistantService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OpenAiProvider, useValue: mockOpenAiProvider },
        { provide: AnthropicProvider, useValue: mockAnthropicProvider },
        { provide: GeminiProvider, useValue: mockGeminiProvider },
        { provide: AiMemoryService, useValue: mockAiMemoryService },
        { provide: AiProposalsService, useValue: mockAiProposalsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiAssistantService>(AiAssistantService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProvider', () => {
    // [OMA-W002-T006] Given provider name, When getProvider is called, Then it resolves requested provider adapter
    it('should return anthropic provider when requested, gemini when requested, otherwise default to primary (openai)', () => {
      // Act & Assert
      expect(service.getProvider('anthropic')).toBe(mockAnthropicProvider);
      expect(service.getProvider('gemini')).toBe(mockGeminiProvider);
      expect(service.getProvider('openai')).toBe(mockOpenAiProvider);
      expect(service.getProvider()).toBe(mockOpenAiProvider);
    });
  });

  describe('transformText', () => {
    // [OMA-W004-T001] Test AI assistant explicit DTO return keys
    it('should transform text with ACADEMIC_TONE mode and instructions', async () => {
      // Arrange
      const dto = {
        text: 'I want to study in UK because it is good.',
        mode: AiEditMode.ACADEMIC_TONE,
        instructions: 'Emphasize postgraduate research ambitions',
      };
      mockOpenAiProvider.generateText.mockResolvedValue(
        'I am ardently pursuing postgraduate scholarship opportunities in the United Kingdom...',
      );

      // Act
      const result = await service.transformText(dto);

      // Assert
      expect(mockOpenAiProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining('elite academic scholarship editor'),
        dto.text,
      );
      expect(mockOpenAiProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining(dto.instructions),
        dto.text,
      );
      expect(result).toEqual({
        originalText: dto.text,
        transformedText: expect.stringContaining('ardently pursuing'),
        mode: AiEditMode.ACADEMIC_TONE,
      });
    });

    // [OMA-W004-T001] Test AI assistant explicit DTO return keys
    it('should correct text with GRAMMAR mode', async () => {
      // Arrange
      const dto = {
        text: 'He have went to the conference yesterday.',
        mode: AiEditMode.GRAMMAR,
      };
      mockOpenAiProvider.generateText.mockResolvedValue(
        'He went to the conference yesterday.',
      );

      // Act
      const result = await service.transformText(dto);

      // Assert
      expect(mockOpenAiProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining('expert English proofreader'),
        dto.text,
      );
      expect(result).toEqual({
        originalText: dto.text,
        transformedText: 'He went to the conference yesterday.',
        mode: AiEditMode.GRAMMAR,
      });
    });

    // [OMA-W004-T001] Test AI assistant explicit DTO return keys
    it('should handle SHORTEN mode appropriately', async () => {
      // Arrange
      const dto = {
        text: 'A very long paragraph with unnecessary repetitive words...',
        mode: AiEditMode.SHORTEN,
      };
      mockOpenAiProvider.generateText.mockResolvedValue('Concise summary.');

      // Act
      const result = await service.transformText(dto);

      // Assert
      expect(mockOpenAiProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Condense the text concisely'),
        dto.text,
      );
      expect(result).toEqual({
        originalText: dto.text,
        transformedText: 'Concise summary.',
        mode: AiEditMode.SHORTEN,
      });
    });
  });

  describe('generateContent', () => {
    // [OMA-W004-T001] Test AI assistant explicit DTO return keys
    it('should generate content with document context', async () => {
      // Arrange
      const dto = {
        prompt: 'Draft an introductory paragraph for an AI ethics statement',
        context: 'Applying for Oxford MSc in Social Science of the Internet',
      };
      mockOpenAiProvider.generateText.mockResolvedValue(
        'Generated opening paragraph',
      );

      // Act
      const result = await service.generateContent(dto);

      // Assert
      expect(mockOpenAiProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining(dto.context),
        dto.prompt,
      );
      expect(result).toEqual({
        content: 'Generated opening paragraph',
        format: 'markdown',
      });
    });
  });

  describe('chat', () => {
    // [OMA-W004-T001] Test AI assistant explicit DTO return keys
    it('should initiate new conversation, save messages, and return assistant reply', async () => {
      // Arrange
      const userId = 'user-1';
      const dto = {
        message: 'How should I structure my leadership essay?',
        pageContext: 'Drafting Chevening Leadership and Influence section',
      };

      const newConversation = { id: 'conv-1', userId, title: dto.message };
      mockPrisma.aiConversations.create.mockResolvedValue(newConversation);
      mockPrisma.aiMessages.findMany.mockResolvedValue([]); // No history
      mockPrisma.aiMessages.create
        .mockResolvedValueOnce({
          id: 'msg-u1',
          role: 'user',
          content: dto.message,
        })
        .mockResolvedValueOnce({
          id: 'msg-a1',
          role: 'assistant',
          content: 'Structure your essay using the STAR method.',
        });
      mockGeminiProvider.chatWithTools.mockResolvedValue({
        reply: 'Structure your essay using the STAR method.',
        toolCalls: [],
      });

      // Act
      const result = await service.chat(userId, dto);

      // Assert
      expect(mockPrisma.aiConversations.create).toHaveBeenCalledWith({
        data: {
          userId,
          title: expect.any(String),
        },
      });
      expect(mockPrisma.aiMessages.create).toHaveBeenCalledWith({
        data: {
          conversationId: newConversation.id,
          role: 'user',
          content: dto.message,
        },
      });
      expect(mockGeminiProvider.chatWithTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining(dto.pageContext),
          }),
          expect.objectContaining({ role: 'user', content: dto.message }),
        ]),
      );
      expect(mockPrisma.aiMessages.create).toHaveBeenCalledWith({
        data: {
          conversationId: newConversation.id,
          role: 'assistant',
          content: 'Structure your essay using the STAR method.',
          sources: undefined,
        },
      });
      expect(result).toEqual({
        conversationId: newConversation.id,
        reply: 'Structure your essay using the STAR method.',
        model: 'gemini-3.5-flash-lite',
      });
    });

    // [OMA-W004-T001] Test AI assistant explicit DTO return keys
    it('should load prior conversation history and append new messages', async () => {
      // Arrange
      const userId = 'user-1';
      const conversationId = 'conv-existing';
      const dto = {
        conversationId,
        message: 'Can you give an example of the Action step?',
      };

      const existingConversation = {
        id: conversationId,
        userId,
        title: 'Chat',
      };
      const priorHistory = [
        { id: 'm-1', role: 'user', content: 'What is STAR?' },
        {
          id: 'm-2',
          role: 'assistant',
          content: 'Situation, Task, Action, Result.',
        },
      ];

      mockPrisma.aiConversations.findFirst.mockResolvedValue(
        existingConversation,
      );
      mockPrisma.aiMessages.findMany.mockResolvedValue(priorHistory);
      mockPrisma.aiMessages.create
        .mockResolvedValueOnce({
          id: 'msg-u2',
          role: 'user',
          content: dto.message,
        })
        .mockResolvedValueOnce({
          id: 'msg-a2',
          role: 'assistant',
          content: 'For example: I organized a cross-functional team...',
        });
      mockGeminiProvider.chatWithTools.mockResolvedValue({
        reply: 'For example: I organized a cross-functional team...',
        toolCalls: [],
      });

      // Act
      const result = await service.chat(userId, dto);

      // Assert
      expect(mockPrisma.aiConversations.findFirst).toHaveBeenCalledWith({
        where: { id: conversationId, userId },
      });
      expect(mockPrisma.aiConversations.create).not.toHaveBeenCalled();
      expect(mockGeminiProvider.chatWithTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'What is STAR?' }),
          expect.objectContaining({
            role: 'assistant',
            content: 'Situation, Task, Action, Result.',
          }),
          expect.objectContaining({ role: 'user', content: dto.message }),
        ]),
      );
      expect(result).toEqual({
        conversationId,
        reply: 'For example: I organized a cross-functional team...',
        model: 'gemini-3.5-flash-lite',
      });
    });

    // [OMA-W006-T006] Test AI assistant chat with memory RAG and tool-calling proposal dispatch
    it('should retrieve relevant memory turns and ground prompt with historical turns', async () => {
      // Arrange
      const userId = 'user-rag-1';
      const conversationId = 'conv-rag-1';
      const dto = {
        conversationId,
        message:
          'Continue our discussion about the community engagement project.',
      };

      mockPrisma.aiConversations.findFirst.mockResolvedValue({
        id: conversationId,
        userId,
      });
      mockPrisma.aiMessages.findMany.mockResolvedValue([]);
      mockPrisma.aiMessages.create
        .mockResolvedValueOnce({ id: 'm-user', role: 'user' })
        .mockResolvedValueOnce({ id: 'm-assist', role: 'assistant' });

      const memoryTurns = [
        {
          messageId: 'old-1',
          role: 'user',
          content: 'I founded a clean water NGO in southern Egypt.',
          similarity: 0.91,
        },
      ];
      mockAiMemoryService.findRelevantTurns.mockResolvedValue(memoryTurns);

      // Act
      await service.chat(userId, dto);

      // Assert
      expect(mockAiMemoryService.findRelevantTurns).toHaveBeenCalledWith(
        conversationId,
        userId,
        dto.message,
        3,
      );
      expect(mockGeminiProvider.chatWithTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining(
              '[Relevant Conversation History Memory]\n(user): I founded a clean water NGO in southern Egypt.',
            ),
          }),
        ]),
      );
    });

    // [OMA-W006-T006] Test AI assistant chat with memory RAG and tool-calling proposal dispatch
    it('should retrieve candidate profile context and ground system prompt', async () => {
      // Arrange
      const userId = 'user-profile-1';
      const dto = {
        message: 'Tailor my personal statement to my research background.',
      };

      mockPrisma.aiConversations.create.mockResolvedValue({
        id: 'conv-new',
        userId,
        title: dto.message,
      });
      mockPrisma.aiMessages.findMany.mockResolvedValue([]);
      mockPrisma.aiMessages.create
        .mockResolvedValueOnce({ id: 'm-u' })
        .mockResolvedValueOnce({ id: 'm-a' });

      const profileContext =
        'Candidate Name: Sarah Connor\nEducation: BSc in Computer Science from MIT (GPA: 3.95)';
      mockAiMemoryService.getUserContext.mockResolvedValue(profileContext);

      // Act
      await service.chat(userId, dto);

      // Assert
      expect(mockAiMemoryService.getUserContext).toHaveBeenCalledWith(userId);
      expect(mockGeminiProvider.chatWithTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining(
              '[Candidate Profile Grounding]\n' + profileContext,
            ),
          }),
        ]),
      );
    });

    // [OMA-W006-T006] Test AI assistant chat with memory RAG and tool-calling proposal dispatch
    it('should invoke background memory indexTurn for both user and assistant turns with catch logging guard', async () => {
      // Arrange
      const userId = 'user-async-1';
      const conversationId = 'conv-async-1';
      const dto = { conversationId, message: 'Explain my research novelty.' };

      mockPrisma.aiConversations.findFirst.mockResolvedValue({
        id: conversationId,
        userId,
      });
      mockPrisma.aiMessages.findMany.mockResolvedValue([]);
      mockPrisma.aiMessages.create
        .mockResolvedValueOnce({ id: 'msg-user-123' })
        .mockResolvedValueOnce({ id: 'msg-assist-456' });

      mockGeminiProvider.chatWithTools.mockResolvedValue({
        reply: 'Your novelty lies in multimodal cross-attention.',
        toolCalls: [],
      });

      // Simulate rejected promise in background indexTurn to test .catch() resilience
      mockAiMemoryService.indexTurn
        .mockRejectedValueOnce(new Error('Async vector DB timeout'))
        .mockResolvedValueOnce(undefined);

      // Act
      const result = await service.chat(userId, dto);

      // Assert: The chat call should resolve cleanly without being crashed by background rejection
      expect(result.reply).toBe(
        'Your novelty lies in multimodal cross-attention.',
      );
      expect(mockAiMemoryService.indexTurn).toHaveBeenCalledWith(
        'msg-user-123',
        conversationId,
        userId,
        dto.message,
      );
      expect(mockAiMemoryService.indexTurn).toHaveBeenCalledWith(
        'msg-assist-456',
        conversationId,
        userId,
        'Your novelty lies in multimodal cross-attention.',
      );
    });

    // [OMA-W006-T006] Test AI assistant chat with memory RAG and tool-calling proposal dispatch
    it('should create proposal via AiProposalsService when Gemini provider emits propose_document_edit tool call', async () => {
      // Arrange
      const userId = 'user-tool-1';
      const conversationId = 'conv-tool-1';
      const dto = {
        conversationId,
        message: 'Please improve this paragraph in my essay.',
      };

      mockPrisma.aiConversations.findFirst.mockResolvedValue({
        id: conversationId,
        userId,
      });
      mockPrisma.aiMessages.findMany.mockResolvedValue([]);
      mockPrisma.aiMessages.create
        .mockResolvedValueOnce({ id: 'm-u' })
        .mockResolvedValueOnce({ id: 'm-a' });

      const mockToolCall = {
        name: 'propose_document_edit',
        args: {
          pageId: 'page-doc-1',
          originalText: 'I worked on robots.',
          suggestedText: 'I engineered autonomous robotics platforms.',
          explanation: 'More technical phrasing.',
        },
      };

      mockGeminiProvider.chatWithTools.mockResolvedValue({
        reply: 'I have proposed an edit for your review.',
        toolCalls: [mockToolCall],
      });

      const mockProposalRecord = {
        id: 'prop-generated-1',
        userId,
        pageId: 'page-doc-1',
        status: 'PENDING',
      };
      mockAiProposalsService.createProposal.mockResolvedValue(
        mockProposalRecord,
      );

      // Act
      const result = await service.chat(userId, dto);

      // Assert
      expect(mockAiProposalsService.createProposal).toHaveBeenCalledWith(
        userId,
        'page-doc-1',
        conversationId,
        'I worked on robots.',
        'I engineered autonomous robotics platforms.',
        'More technical phrasing.',
      );
      expect(result.proposals).toEqual([mockProposalRecord]);
      expect(mockPrisma.aiMessages.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'assistant',
          sources: [mockProposalRecord],
        }),
      });
    });

    // [OMA-W006-T006] Test AI assistant chat with memory RAG and tool-calling proposal dispatch
    it('should handle tool call proposal creation failure gracefully without crashing chat', async () => {
      // Arrange
      const userId = 'user-err-1';
      const conversationId = 'conv-err-1';
      const dto = {
        conversationId,
        message: 'Improve my intro',
      };

      mockPrisma.aiConversations.findFirst.mockResolvedValue({
        id: conversationId,
        userId,
      });
      mockPrisma.aiMessages.findMany.mockResolvedValue([]);
      mockPrisma.aiMessages.create
        .mockResolvedValueOnce({ id: 'm-u' })
        .mockResolvedValueOnce({ id: 'm-a' });

      mockGeminiProvider.chatWithTools.mockResolvedValue({
        reply: 'Attempted proposal but draft page was deleted.',
        toolCalls: [
          {
            name: 'propose_document_edit',
            args: {
              pageId: 'page-deleted-99',
              originalText: 'Draft',
              suggestedText: 'Final',
            },
          },
        ],
      });

      mockAiProposalsService.createProposal.mockRejectedValue(
        new Error('Draft page not found'),
      );

      // Act
      const result = await service.chat(userId, dto);

      // Assert
      expect(result.reply).toBe(
        'Attempted proposal but draft page was deleted.',
      );
      expect(result.proposals).toBeUndefined();
    });
  });
});
