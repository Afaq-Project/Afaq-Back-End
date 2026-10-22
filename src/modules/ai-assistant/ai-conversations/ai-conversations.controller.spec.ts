// [OMA-W009-T004] AiConversationsController Unit Tests
import { Test, TestingModule } from '@nestjs/testing';
import { AiConversationsController } from './ai-conversations.controller';
import { AiAssistantService } from '../ai-assistant.service';
import { ConversationPaginationQueryDto } from '../dto/conversation-pagination-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('AiConversationsController', () => {
  let controller: AiConversationsController;
  let mockAiAssistantService: {
    listConversations: jest.Mock;
    getConversationMessages: jest.Mock;
  };

  beforeEach(async () => {
    mockAiAssistantService = {
      listConversations: jest.fn(),
      getConversationMessages: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiConversationsController],
      providers: [
        {
          provide: AiAssistantService,
          useValue: mockAiAssistantService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AiConversationsController>(
      AiConversationsController,
    );
    jest.clearAllMocks();
  });

  // [OMA-W009-T004]
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listConversations', () => {
    // [OMA-W009-T004]
    it('should pass userId and query correctly to AiAssistantService.listConversations', async () => {
      const userId = 'user-uuid-1';
      const query: ConversationPaginationQueryDto = { page: 2, limit: 10 };
      const mockResult = {
        items: [
          {
            id: 'conv-1',
            title: 'Session 1',
            messageCount: 3,
            lastMessagePreview: 'Hello world',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        meta: { total: 1, page: 2, limit: 10, totalPages: 1 },
      };
      mockAiAssistantService.listConversations.mockResolvedValue(mockResult);

      const result = await controller.listConversations(userId, query);

      expect(mockAiAssistantService.listConversations).toHaveBeenCalledWith(
        userId,
        query,
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('getConversationMessages', () => {
    // [OMA-W009-T004]
    it('should pass userId, conversationId, and query correctly to AiAssistantService.getConversationMessages', async () => {
      const userId = 'user-uuid-1';
      const conversationId = 'c0a80101-0000-0000-0000-000000000001';
      const query: ConversationPaginationQueryDto = { page: 1, limit: 20 };
      const mockResult = {
        conversationId,
        title: 'Session 1',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Review my statement',
            createdAt: new Date(),
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockAiAssistantService.getConversationMessages.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getConversationMessages(
        userId,
        conversationId,
        query,
      );

      expect(
        mockAiAssistantService.getConversationMessages,
      ).toHaveBeenCalledWith(userId, conversationId, query);
      expect(result).toBe(mockResult);
    });
  });
});
