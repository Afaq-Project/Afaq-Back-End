/* eslint-disable @typescript-eslint/unbound-method */
// [OMA-W004-T001] AiChatController Spec
import { Test, TestingModule } from '@nestjs/testing';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiChatController } from './ai-chat.controller';
import { AiAssistantService } from '../ai-assistant.service';

describe('AiChatController', () => {
  let controller: AiChatController;
  let mockAiService: {
    chat: jest.Mock;
  };

  const mockUser = { id: 'user-123' };
  const mockReq = { user: mockUser };

  beforeEach(async () => {
    mockAiService = {
      chat: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiChatController],
      providers: [
        {
          provide: AiAssistantService,
          useValue: mockAiService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AiChatController>(AiChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('chat', () => {
    // [OMA-W004-T001] Test AI controller HTTP 200 OK status metadata
    it('should have HTTP 200 OK metadata configured on chat endpoint', () => {
      const httpCode = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        AiChatController.prototype.chat,
      );
      expect(httpCode).toBe(HttpStatus.OK);
      expect(httpCode).toBe(200);

      const httpCodeDirect = Reflect.getMetadata(
        '__httpCode__',
        AiChatController.prototype.chat,
      );
      expect(httpCodeDirect).toBe(200);
    });

    // [OMA-W004-T001] Test AI controller HTTP 200 OK status metadata
    it('should delegate chat to service with authenticated userId and return result', async () => {
      const dto = {
        message: 'How do I frame my career goals?',
        pageContext: 'Personal statement drafting',
      };
      const expectedResult = {
        conversationId: 'conv-123',
        reply: 'Focus on short-term and long-term milestones.',
        model: 'gpt-4o',
      };
      mockAiService.chat.mockResolvedValue(expectedResult);

      const result = await controller.chat(mockReq, dto);

      expect(mockAiService.chat).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual(expectedResult);
    });
  });
});
