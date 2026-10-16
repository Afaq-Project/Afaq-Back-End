import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { RecommendationsRepository } from './recommendations.repository';
import { ListMatchesDto } from './dto/list-matches.dto';
import {
  MatchListResponseDto,
  MatchWithOpportunityListResponseDto,
  MatchWithOpportunityDto,
} from './dto/match-response.dto';
import { createHash } from 'crypto';
import {
  CACHE_PREFIX_MATCHES,
  CACHE_PREFIX_COMBINED,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MATCH_SORT_WHITELIST,
} from './recommendations.constants';
import { toMatchDto } from './recommendations.mapper';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly repository: RecommendationsRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  async getMatches(
    userId: string,
    dto: ListMatchesDto,
  ): Promise<MatchListResponseDto> {
    if (
      dto.sort &&
      !MATCH_SORT_WHITELIST.includes(
        dto.sort as (typeof MATCH_SORT_WHITELIST)[number],
      )
    ) {
      throw new BadRequestException('INVALID_SORT');
    }

    const limit = Math.min(dto.limit || DEFAULT_LIMIT, MAX_LIMIT);
    const page = dto.page || 1;
    const skip = (page - 1) * limit;

    const normalizedDto = Object.keys(dto)
      .filter((k) => dto[k as keyof ListMatchesDto] !== undefined)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = dto[key as keyof ListMatchesDto];
        return acc;
      }, {});

    const normalizedQueryString = JSON.stringify(normalizedDto);
    const hash = createHash('sha1').update(normalizedQueryString).digest('hex');
    const cacheKey = `${CACHE_PREFIX_MATCHES}:${userId}:${hash}`;

    try {
      const cached =
        await this.cacheManager.get<MatchListResponseDto>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e: unknown) {
      this.logger.warn(
        `Cache get error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const synced_at = new Date();

    const { data, total } = await this.repository.findMatches(
      userId,
      dto,
      limit,
      skip,
    );

    const pages = Math.ceil(total / limit);

    const result: MatchListResponseDto = {
      data: data.map((d) => toMatchDto(d as Parameters<typeof toMatchDto>[0])),
      meta: {
        page,
        limit,
        total,
        pages,
        synced_at,
      },
    };

    try {
      const ttlSec =
        this.configService.get<number>(
          'recommendations.RECOMMENDATIONS_MATCHES_CACHE_TTL_SEC',
        ) ?? 1800;
      await this.cacheManager.set(cacheKey, result, ttlSec * 1000);
    } catch (e: unknown) {
      this.logger.warn(
        `Cache set error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return result;
  }

  async getMatchesWithOpportunities(
    userId: string,
    dto: ListMatchesDto,
  ): Promise<MatchWithOpportunityListResponseDto> {
    if (
      dto.sort &&
      !MATCH_SORT_WHITELIST.includes(
        dto.sort as (typeof MATCH_SORT_WHITELIST)[number],
      )
    ) {
      throw new BadRequestException('INVALID_SORT');
    }

    const limit = Math.min(dto.limit || DEFAULT_LIMIT, MAX_LIMIT);
    const page = dto.page || 1;
    const skip = (page - 1) * limit;

    const normalizedDto = Object.keys(dto)
      .filter((k) => dto[k as keyof ListMatchesDto] !== undefined)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = dto[key as keyof ListMatchesDto];
        return acc;
      }, {});

    const normalizedQueryString = JSON.stringify(normalizedDto);
    const hash = createHash('sha1').update(normalizedQueryString).digest('hex');
    const cacheKey = `${CACHE_PREFIX_COMBINED}:${userId}:${hash}`;

    try {
      const cached =
        await this.cacheManager.get<MatchWithOpportunityListResponseDto>(
          cacheKey,
        );
      if (cached) {
        return cached;
      }
    } catch (e: unknown) {
      this.logger.warn(
        `Cache get error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const synced_at = new Date();

    const { data, total } = await this.repository.findMatchesWithOpportunity(
      userId,
      dto,
      limit,
      skip,
    );

    const pages = Math.ceil(total / limit);

    const result: MatchWithOpportunityListResponseDto = {
      data: data.map(
        (d) =>
          toMatchDto(
            d as Parameters<typeof toMatchDto>[0],
          ) as MatchWithOpportunityDto,
      ),
      meta: {
        page,
        limit,
        total,
        pages,
        synced_at,
      },
    };

    try {
      const ttlSec =
        this.configService.get<number>(
          'recommendations.RECOMMENDATIONS_COMBINED_CACHE_TTL_SEC',
        ) ?? 300;
      await this.cacheManager.set(cacheKey, result, ttlSec * 1000);
    } catch (e: unknown) {
      this.logger.warn(
        `Cache set error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return result;
  }
}
