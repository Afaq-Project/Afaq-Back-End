// [OMA-W009-T004] E2E Integration Tests for Feature 12 (AI Conversation Management)
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from '../src/common/interceptors/timeout.interceptor';
import { ConfigurableValidationPipe } from '../src/common/pipes/configurable-validation.pipe';

describe('AiConversations (e2e)', () => {
  let app: INestApplication;

  const testUserId = '11111111-1111-1111-1111-111111111111';
  const testConversationId = '22222222-2222-2222-2222-222222222222';
  const unownedConversationId = '33333333-3333-3333-3333-333333333333';

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    aiConversations: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    aiMessages: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(JwtService)
      .useValue({
        verifyAsync: jest.fn().mockImplementation((token: string) => {
          if (token === 'valid-token') {
            return Promise.resolve({ sub: testUserId });
          }
          throw new Error('Invalid token');
        }),
      })
      .overrideProvider(AuthService)
      .useValue({
        validateUser: jest.fn().mockResolvedValue({ id: testUserId }),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

    const reflector = app.get(Reflector);
    app.useGlobalPipes(
      new ConfigurableValidationPipe(reflector, {
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(
      new TransformInterceptor(reflector),
      new TimeoutInterceptor(),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Guard', () => {
    // [OMA-W009-T004]
    it('GET /api/v1/editor/ai/conversations should return 401 Unauthorized without JWT', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/editor/ai/conversations')
        .expect(401);
    });

    // [OMA-W009-T004]
    it('GET /api/v1/editor/ai/conversations/:id/messages should return 401 Unauthorized without JWT', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/editor/ai/conversations/${testConversationId}/messages`)
        .expect(401);
    });
  });

  describe('GET /api/v1/editor/ai/conversations', () => {
    // [OMA-W009-T004]
    it('should return 200 with standard envelope { statusCode: 200, message: ..., data: { items, meta } }', async () => {
      const mockDate = new Date();
      mockPrismaService.aiConversations.count.mockResolvedValue(1);
      mockPrismaService.aiConversations.findMany.mockResolvedValue([
        {
          id: testConversationId,
          title: 'Essay Feedback Session',
          createdAt: mockDate,
          updatedAt: mockDate,
          _count: { messages: 2 },
          messages: [{ content: 'Could you review my scholarship statement?' }],
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/editor/ai/conversations')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(res.body).toHaveProperty('statusCode', 200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0]).toEqual({
        id: testConversationId,
        title: 'Essay Feedback Session',
        messageCount: 2,
        lastMessagePreview: 'Could you review my scholarship statement?',
        createdAt: mockDate.toISOString(),
        updatedAt: mockDate.toISOString(),
      });
      expect(res.body.data.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });
  });

  describe('GET /api/v1/editor/ai/conversations/:id/messages', () => {
    // [OMA-W009-T004]
    it('should return 200 with conversation messages when conversation exists and is owned by user', async () => {
      const mockDate = new Date();
      mockPrismaService.aiConversations.findFirst.mockResolvedValue({
        id: testConversationId,
        title: 'Essay Feedback Session',
      });
      mockPrismaService.aiMessages.count.mockResolvedValue(1);
      mockPrismaService.aiMessages.findMany.mockResolvedValue([
        {
          id: 'msg-uuid-1',
          role: 'user',
          content: 'Hello AI',
          createdAt: mockDate,
        },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/editor/ai/conversations/${testConversationId}/messages`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(res.body).toHaveProperty('statusCode', 200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.data).toHaveProperty(
        'conversationId',
        testConversationId,
      );
      expect(res.body.data).toHaveProperty('title', 'Essay Feedback Session');
      expect(res.body.data).toHaveProperty('messages');
      expect(res.body.data.messages).toHaveLength(1);
      expect(res.body.data.messages[0]).toEqual({
        id: 'msg-uuid-1',
        role: 'user',
        content: 'Hello AI',
        createdAt: mockDate.toISOString(),
      });
      expect(res.body.data.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    // [OMA-W009-T004]
    it('should return 404 for unowned conversation ID', async () => {
      mockPrismaService.aiConversations.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/editor/ai/conversations/${unownedConversationId}/messages`,
        )
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
      expect(mockPrismaService.aiConversations.findFirst).toHaveBeenCalledWith({
        where: { id: unownedConversationId, userId: testUserId },
        select: { id: true, title: true },
      });
    });

    // [OMA-W009-T004]
    it('should return 400 Bad Request due to ParseUUIDPipe when conversation ID is not a UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/editor/ai/conversations/not-a-uuid/messages')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
      expect(
        mockPrismaService.aiConversations.findFirst,
      ).not.toHaveBeenCalled();
    });
  });
});
