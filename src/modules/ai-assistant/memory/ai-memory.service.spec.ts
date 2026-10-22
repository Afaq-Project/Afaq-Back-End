// [OMA-W006-T004] Test conversational memory RAG and profile grounding
import { Test, TestingModule } from '@nestjs/testing';
import { AiMemoryService } from './ai-memory.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocalEmbeddingService } from './local-embedding.service';

describe('AiMemoryService', () => {
  let service: AiMemoryService;
  let mockPrisma: {
    $executeRawUnsafe: jest.Mock;
    $queryRawUnsafe: jest.Mock;
    userProfiles: {
      findUnique: jest.Mock;
    };
  };
  let mockLocalEmbeddingService: {
    generateEmbedding: jest.Mock;
  };

  beforeEach(async () => {
    mockPrisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      userProfiles: {
        findUnique: jest.fn(),
      },
    };

    mockLocalEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(384).fill(0.01)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiMemoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LocalEmbeddingService, useValue: mockLocalEmbeddingService },
      ],
    }).compile();

    service = module.get<AiMemoryService>(AiMemoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // [OMA-W006-T004] Test conversational memory RAG and profile grounding
  describe('indexTurn', () => {
    it('should generate embeddings and execute raw SQL insert with vector parameter', async () => {
      // Arrange
      const messageId = 'msg-uuid-1';
      const conversationId = 'conv-uuid-1';
      const userId = 'user-uuid-1';
      const content = 'I led a clean water NGO project in 2024';

      // Act
      await service.indexTurn(messageId, conversationId, userId, content);

      // Assert
      expect(mockLocalEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        content,
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_message_embeddings'),
        messageId,
        conversationId,
        userId,
        expect.stringMatching(/^\[0\.01(,0\.01)+\]$/),
      );
    });

    it('should skip indexing when content is empty or whitespace', async () => {
      // Act
      await service.indexTurn('msg-1', 'conv-1', 'user-1', '');
      await service.indexTurn('msg-1', 'conv-1', 'user-1', '   ');

      // Assert
      expect(
        mockLocalEmbeddingService.generateEmbedding,
      ).not.toHaveBeenCalled();
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should catch and log database errors safely without throwing exception', async () => {
      // Arrange
      mockPrisma.$executeRawUnsafe.mockRejectedValue(
        new Error('DB connection refused'),
      );

      // Act & Assert
      await expect(
        service.indexTurn('msg-1', 'conv-1', 'user-1', 'Valid turn content'),
      ).resolves.not.toThrow();
    });
  });

  // [OMA-W006-T004] Test conversational memory RAG and profile grounding
  describe('findRelevantTurns', () => {
    it('should perform vector similarity query with tenant isolation, recent turn exclusion, and limit', async () => {
      // Arrange
      const conversationId = 'conv-uuid-1';
      const userId = 'user-uuid-1';
      const query = 'What leadership examples did I mention?';
      const topK = 5;

      const mockRows = [
        {
          messageId: 'msg-old-1',
          role: 'user',
          content: 'I founded a robotics initiative at university.',
          similarity: 0.88,
        },
        {
          messageId: 'msg-old-2',
          role: 'assistant',
          content: 'That robotics initiative shows high initiative.',
          similarity: '0.82', // test string parsing
        },
      ];
      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockRows);

      // Act
      const result = await service.findRelevantTurns(
        conversationId,
        userId,
        query,
        topK,
      );

      // Assert
      expect(mockLocalEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        query,
      );
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringMatching(
          /WHERE e\.conversation_id = \$2::uuid\s+AND e\.user_id = \$3::uuid/i,
        ),
        expect.any(String),
        conversationId,
        userId,
        topK,
      );

      // Verify recent turns exclusion clause is present in query
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 3'),
        expect.any(String),
        conversationId,
        userId,
        topK,
      );

      // Verify mapped results
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        messageId: 'msg-old-1',
        role: 'user',
        content: 'I founded a robotics initiative at university.',
        similarity: 0.88,
      });
      expect(result[1].similarity).toBe(0.82);
    });

    it('should return empty array if query is empty or whitespace', async () => {
      // Act
      const resEmpty = await service.findRelevantTurns('conv-1', 'user-1', '');
      const resSpaces = await service.findRelevantTurns(
        'conv-1',
        'user-1',
        '   ',
      );

      // Assert
      expect(resEmpty).toEqual([]);
      expect(resSpaces).toEqual([]);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('should catch query failure and return empty context safely', async () => {
      // Arrange
      mockPrisma.$queryRawUnsafe.mockRejectedValue(
        new Error('pgvector extension error'),
      );

      // Act
      const result = await service.findRelevantTurns(
        'conv-1',
        'user-1',
        'query',
      );

      // Assert
      expect(result).toEqual([]);
    });
  });

  // [OMA-W006-T004] Test conversational memory RAG and profile grounding
  describe('getUserContext', () => {
    it('should format full candidate profile context with education, GPA, degree, and languages', async () => {
      // Arrange
      const userId = 'user-uuid-1';
      const mockProfile = {
        userId,
        firstName: 'Fatima',
        lastName: 'Al-Zahra',
        bio: 'Aspiring AI researcher focused on natural language understanding',
        experiences: [
          'ML Engineer Intern at TechCorp',
          'Research Assistant at UniLab',
        ],
        educations: [
          {
            gpaNormalized: 3.92,
            gpaRaw: '3.92/4.0',
            educationLevel: { nameEn: 'Bachelor of Science' },
            major: { nameEn: 'Computer Science' },
            institution: { nameEn: 'Cairo University' },
          },
        ],
        languages: [
          {
            isNative: true,
            language: { nameEn: 'Arabic' },
            proficiencyLevel: { nameEn: 'Native' },
          },
          {
            isNative: false,
            language: { nameEn: 'English' },
            proficiencyLevel: { nameEn: 'C1 Fluent' },
          },
        ],
      };
      mockPrisma.userProfiles.findUnique.mockResolvedValue(mockProfile);

      // Act
      const context = await service.getUserContext(userId);

      // Assert
      expect(mockPrisma.userProfiles.findUnique).toHaveBeenCalledWith({
        where: { userId },
        include: expect.objectContaining({
          educations: expect.any(Object),
          languages: expect.any(Object),
        }),
      });

      expect(context).toContain('Candidate Name: Fatima Al-Zahra');
      expect(context).toContain('Bio: Aspiring AI researcher');
      expect(context).toContain(
        'Experiences: ML Engineer Intern at TechCorp; Research Assistant at UniLab',
      );
      expect(context).toContain(
        'Education: Bachelor of Science in Computer Science from Cairo University (GPA: 3.92)',
      );
      expect(context).toContain(
        'Languages: Arabic (Native); English (C1 Fluent)',
      );
    });

    it('should handle null or non-existent profile safely by returning empty string without throwing', async () => {
      // Arrange
      mockPrisma.userProfiles.findUnique.mockResolvedValue(null);

      // Act
      const context = await service.getUserContext('non-existent-user');

      // Assert
      expect(context).toBe('');
    });

    it('should catch database exceptions and return empty string safely', async () => {
      // Arrange
      mockPrisma.userProfiles.findUnique.mockRejectedValue(
        new Error('Database timeout'),
      );

      // Act
      const context = await service.getUserContext('user-1');

      // Assert
      expect(context).toBe('');
    });
  });
});
