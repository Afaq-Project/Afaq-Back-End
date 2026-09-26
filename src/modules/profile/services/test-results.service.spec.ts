import { Test, TestingModule } from '@nestjs/testing';
import { TestResultsService } from './test-results.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('TestResultsService', () => {
  let service: TestResultsService;

  const mockPrisma = {
    systemSettings: {
      findUnique: jest.fn(),
    },
    userTestResults: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    standardizedTests: {
      findUnique: jest.fn(),
    },
  };

  const mockProfileService = {
    recalculate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestResultsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProfileService, useValue: mockProfileService },
      ],
    }).compile();

    service = module.get<TestResultsService>(TestResultsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Score Validation Regression (Batch 4)', () => {
    const ieltsTest = {
      id: 'test-ielts-id',
      isActive: true,
      minScore: new Prisma.Decimal('0.0'),
      maxScore: new Prisma.Decimal('9.0'),
      scoreStep: new Prisma.Decimal('0.5'),
    };

    it('rejects IELTS score 7.3 with SCORE_NOT_ALIGNED_TO_STEP', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: '10' });
      mockPrisma.userTestResults.count.mockResolvedValue(0);
      mockPrisma.standardizedTests.findUnique.mockResolvedValue(ieltsTest);

      await expect(
        service.create('user-1', { testId: 'test-ielts-id', score: 7.3 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts IELTS score 7.5', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: '10' });
      mockPrisma.userTestResults.count.mockResolvedValue(0);
      mockPrisma.standardizedTests.findUnique.mockResolvedValue(ieltsTest);
      mockPrisma.userTestResults.findFirst.mockResolvedValue(null);
      mockPrisma.userTestResults.create.mockResolvedValue({ id: 'res-1' });

      await service.create('user-1', { testId: 'test-ielts-id', score: 7.5 });

      expect(mockPrisma.userTestResults.create).toHaveBeenCalled();
    });
  });
});
