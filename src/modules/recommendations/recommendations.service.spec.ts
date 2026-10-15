/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsRepository } from './recommendations.repository';
import { AiPrismaService } from '../infrastructure/ai-prisma/ai-prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import {
  MAX_LIMIT,
  INACTIVE_OPPORTUNITY_STATUSES,
} from './recommendations.constants';
import { ListMatchesDto } from './dto/list-matches.dto';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let repository: jest.Mocked<RecommendationsRepository>;
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    repository = {
      findMatches: jest.fn(),
      findMatchesWithOpportunity: jest.fn(),
    } as unknown as jest.Mocked<RecommendationsRepository>;

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'recommendations.RECOMMENDATIONS_MATCHES_CACHE_TTL_SEC') {
          return 3600;
        }
        return null;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: RecommendationsRepository, useValue: repository },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
  });

  describe('getMatches', () => {
    const userId = 'user123';

    it('should return matches using default limit and page', async () => {
      repository.findMatches.mockResolvedValue({ data: [], total: 0 });
      cacheManager.get.mockResolvedValue(null);

      const result = await service.getMatches(userId, {});

      expect(repository.findMatches).toHaveBeenCalledWith(
        userId,
        {},
        20, // default limit
        0, // default skip
      );
      expect(result.meta).toMatchObject({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      });
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should clamp limit to MAX_LIMIT', async () => {
      repository.findMatches.mockResolvedValue({ data: [], total: 0 });
      cacheManager.get.mockResolvedValue(null);

      const dto: ListMatchesDto = { limit: 999 };
      const result = await service.getMatches(userId, dto);

      expect(repository.findMatches).toHaveBeenCalledWith(
        userId,
        dto,
        MAX_LIMIT,
        0,
      );
      expect(result.meta.limit).toBe(MAX_LIMIT);
    });

    it('should throw BadRequestException on invalid sort', async () => {
      const dto = { sort: 'invalid_sort' } as ListMatchesDto;
      await expect(service.getMatches(userId, dto)).rejects.toThrow(
        new BadRequestException('INVALID_SORT'),
      );
    });

    it('should handle cache hit and not call repository', async () => {
      const cachedResult = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, pages: 0, synced_at: new Date() },
      };
      cacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.getMatches(userId, {});

      expect(result).toEqual(cachedResult);
      expect(repository.findMatches).not.toHaveBeenCalled();
    });

    it('should propagate errors from the repository (e.g., 503 mapping)', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findMatches.mockRejectedValue(
        new Error('SERVICE_UNAVAILABLE'),
      );

      await expect(service.getMatches(userId, {})).rejects.toThrow(
        'SERVICE_UNAVAILABLE',
      );
    });

    it('should ignore cache get errors and proceed', async () => {
      cacheManager.get.mockRejectedValue(new Error('Cache error'));
      repository.findMatches.mockResolvedValue({ data: [], total: 0 });

      const result = await service.getMatches(userId, {});

      expect(repository.findMatches).toHaveBeenCalled();
      expect(result.meta.total).toBe(0);
    });

    it('should ignore cache set errors and return result', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findMatches.mockResolvedValue({ data: [], total: 0 });
      cacheManager.set.mockRejectedValue(new Error('Cache set error'));

      const result = await service.getMatches(userId, {});

      expect(result.meta.total).toBe(0);
    });

    it('should handle min_score parameter correctly (meta total)', async () => {
      cacheManager.get.mockResolvedValue(null);
      const data = [
        {
          opportunityId: 'opp1',
          scorePct: 80,
          scoreBreakdown: {},
          calculationVersion: 1,
          calculatedAt: new Date(),
        },
      ];
      repository.findMatches.mockResolvedValue({ data, total: 1 });

      const dto: ListMatchesDto = { min_score: 50 };
      const result = await service.getMatches(userId, dto);

      expect(repository.findMatches).toHaveBeenCalledWith(userId, dto, 20, 0);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].score_pct).toBe(80);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getMatchesWithOpportunities', () => {
    const userId = 'user123';

    it('should return combined shape and use correct cache prefix (short TTL)', async () => {
      repository.findMatchesWithOpportunity.mockResolvedValue({
        data: [],
        total: 0,
      });
      cacheManager.get.mockResolvedValue(null);

      const result = await service.getMatchesWithOpportunities(userId, {});

      expect(repository.findMatchesWithOpportunity).toHaveBeenCalledWith(
        userId,
        {},
        20,
        0,
      );
      expect(result.meta).toMatchObject({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      });
      // Check short TTL separation (uses a different cache key prefix than default)
      expect(cacheManager.get).toHaveBeenCalledWith(
        expect.stringContaining('rec:combined:'),
      );
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should throw BadRequestException on invalid sort (EC-021 parity)', async () => {
      const dto = { sort: 'invalid_sort' } as any;
      await expect(
        service.getMatchesWithOpportunities(userId, dto),
      ).rejects.toThrow(new BadRequestException('INVALID_SORT'));
    });

    it('should handle cache hit and not call repository', async () => {
      const cachedResult = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, pages: 0, synced_at: new Date() },
      };
      cacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.getMatchesWithOpportunities(userId, {});

      expect(result).toEqual(cachedResult);
      expect(repository.findMatchesWithOpportunity).not.toHaveBeenCalled();
    });

    it('should propagate errors from the repository (e.g., 503 mapping)', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findMatchesWithOpportunity.mockRejectedValue(
        new Error('SERVICE_UNAVAILABLE'),
      );

      await expect(
        service.getMatchesWithOpportunities(userId, {}),
      ).rejects.toThrow('SERVICE_UNAVAILABLE');
    });
  });
});

describe('RecommendationsRepository Filters', () => {
  let repository: RecommendationsRepository;
  let aiPrisma: jest.Mocked<AiPrismaService>;

  beforeEach(() => {
    aiPrisma = {
      matchScore: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as jest.Mocked<AiPrismaService>;
    repository = new RecommendationsRepository(aiPrisma);
  });
  it('should build where clause for each filter and multi-filter AND', async () => {
    (aiPrisma.matchScore.findMany as jest.Mock).mockResolvedValue([]);
    (aiPrisma.matchScore.count as jest.Mock).mockResolvedValue(0);

    const dto = {
      country: 'USA',
      opportunity_type: 'Scholarship',
      funding_type: 'Fully Funded',
      is_remote: true,
      source_id: 'src1',
      study_levels: 'Bachelors, Masters',
      fields_of_study: 'CS, IT',
      q: 'search term',
      include_expired: true,
    };

    await repository.findMatches('user1', dto, 10, 0);

    const call = (aiPrisma.matchScore.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).toBeDefined();
    expect(call.where.opportunity).toBeDefined();
    const oppWhere = call.where.opportunity.is;

    expect(oppWhere.country).toEqual({ equals: 'USA' });
    expect(oppWhere.opportunityType).toEqual({ equals: 'Scholarship' });
    expect(oppWhere.fundingType).toEqual({ equals: 'Fully Funded' });
    expect(oppWhere.isRemote).toEqual({ equals: true });
    expect(oppWhere.sourceId).toEqual({ equals: 'src1' });
    expect(oppWhere.studyLevels).toEqual({ hasSome: ['Bachelors', 'Masters'] });
    expect(oppWhere.fieldsOfStudy).toEqual({ hasSome: ['CS', 'IT'] });
    expect(oppWhere.OR).toEqual([
      { title: { contains: 'search term', mode: 'insensitive' } },
      { description: { contains: 'search term', mode: 'insensitive' } },
    ]);
  });

  it('should handle date-range error', async () => {
    const dto = {
      deadline_from: '2025-01-01',
      deadline_to: '2024-01-01',
    };

    await expect(repository.findMatches('user1', dto, 10, 0)).rejects.toThrow(
      new BadRequestException(
        'deadline_from must not be later than deadline_to',
        'INVALID_DATE_RANGE',
      ),
    );
  });

  it('should handle expired/inactive default vs include_expired=true', async () => {
    (aiPrisma.matchScore.findMany as jest.Mock).mockResolvedValue([]);
    (aiPrisma.matchScore.count as jest.Mock).mockResolvedValue(0);

    // Default (include_expired = false)
    await repository.findMatches('user1', {}, 10, 0);
    let call = (aiPrisma.matchScore.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.opportunity.is.OR).toEqual([
      { deadline: null },
      { deadline: { gte: expect.any(Date) } },
    ]);
    expect(call.where.opportunity.is.status).toEqual({
      notIn: INACTIVE_OPPORTUNITY_STATUSES,
    });

    (aiPrisma.matchScore.findMany as jest.Mock).mockClear();

    // Include expired
    await repository.findMatches('user1', { include_expired: true }, 10, 0);
    call = (aiPrisma.matchScore.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.opportunity).toBeUndefined(); // No other filters
  });

  it('should handle null deadline correctly (part of default active rule)', async () => {
    (aiPrisma.matchScore.findMany as jest.Mock).mockResolvedValue([]);
    (aiPrisma.matchScore.count as jest.Mock).mockResolvedValue(0);
    await repository.findMatches('user1', {}, 10, 0);
    const call = (aiPrisma.matchScore.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.opportunity.is.OR).toContainEqual({ deadline: null });
  });

  it('should handle orphan handling by not returning matches where opportunity is missing if filtered', async () => {
    // Or just test that relation filter "opportunity: { is: ... }" handles it
    (aiPrisma.matchScore.findMany as jest.Mock).mockResolvedValue([]);
    (aiPrisma.matchScore.count as jest.Mock).mockResolvedValue(0);
    await repository.findMatches('user1', { country: 'USA' }, 10, 0);
    const call = (aiPrisma.matchScore.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.opportunity).toBeDefined();
  });

  // [OMA-W001-T002] (logic) test zero and null score exclusions
  describe('score_pct filtering and exclusions', () => {
    it('should always exclude score_pct <= 0 or null by default (gt: 0)', async () => {
      (aiPrisma.matchScore.findMany as jest.Mock).mockResolvedValue([]);
      (aiPrisma.matchScore.count as jest.Mock).mockResolvedValue(0);

      await repository.findMatches('user1', {}, 10, 0);

      const findManyCall = (aiPrisma.matchScore.findMany as jest.Mock).mock
        .calls[0][0];
      const countCall = (aiPrisma.matchScore.count as jest.Mock).mock
        .calls[0][0];

      expect(findManyCall.where.scorePct).toEqual({ gt: 0 });
      expect(countCall.where.scorePct).toEqual({ gt: 0 });
    });

    it('should set gte to max(min_score, 1) when min_score is provided', async () => {
      (aiPrisma.matchScore.findMany as jest.Mock).mockResolvedValue([]);
      (aiPrisma.matchScore.count as jest.Mock).mockResolvedValue(0);

      await repository.findMatches('user1', { min_score: 50 }, 10, 0);

      const findManyCall = (aiPrisma.matchScore.findMany as jest.Mock).mock
        .calls[0][0];
      expect(findManyCall.where.scorePct).toEqual({ gt: 0, gte: 50 });
    });

    it('should apply gt: 0 in findMatchesWithOpportunity query as well', async () => {
      (aiPrisma.matchScore.findMany as jest.Mock).mockResolvedValue([]);
      (aiPrisma.matchScore.count as jest.Mock).mockResolvedValue(0);

      await repository.findMatchesWithOpportunity('user1', {}, 10, 0);

      const findManyCall = (aiPrisma.matchScore.findMany as jest.Mock).mock
        .calls[0][0];
      expect(findManyCall.where.scorePct).toEqual({ gt: 0 });
    });
  });
});
