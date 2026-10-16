import {
  Injectable,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { AiPrismaService } from '../infrastructure/ai-prisma/ai-prisma.service';
import { Prisma } from '@prisma/ai-client';
import { ListMatchesDto } from './dto/list-matches.dto';
import { buildOpportunityWhere } from '../opportunities/opportunity-filter.builder';
import {
  MATCH_SORT_TO_ORDER_BY,
  INACTIVE_OPPORTUNITY_STATUSES,
} from './recommendations.constants';
import { BRIEF_OPPORTUNITY_SELECT } from '../opportunities/opportunity-brief.mapper';

@Injectable()
export class RecommendationsRepository {
  private readonly logger = new Logger(RecommendationsRepository.name);

  constructor(private readonly aiPrisma: AiPrismaService) {}

  private handlePrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code.startsWith('P1'))
    ) {
      this.logger.error('AI Database connection error', error);
      throw new ServiceUnavailableException('SERVICE_UNAVAILABLE');
    }
    throw error;
  }

  private buildWhere(
    userId: string,
    dto: ListMatchesDto,
  ): Prisma.MatchScoreWhereInput {
    const where: Prisma.MatchScoreWhereInput = {
      userId: { equals: userId },
    };

    // [OMA-W001-T001] (logic) exclude zero and null scores
    where.scorePct = {
      gt: 0,
      ...(dto.min_score !== undefined
        ? { gte: Math.max(dto.min_score, 1) }
        : {}),
    };

    if (dto.calculated_after) {
      where.calculatedAt = { gt: new Date(dto.calculated_after) };
    }

    const opportunityWhere = buildOpportunityWhere(dto);

    if (!dto.include_expired) {
      const now = new Date();
      const expiredRule = {
        OR: [{ deadline: null }, { deadline: { gte: now } }],
      };

      if (opportunityWhere.OR) {
        opportunityWhere.AND = opportunityWhere.AND || [];
        (opportunityWhere.AND as Prisma.CleanedOpportunityWhereInput[]).push(
          expiredRule,
          {
            OR: opportunityWhere.OR,
          },
        );
        delete opportunityWhere.OR;
      } else {
        opportunityWhere.OR = expiredRule.OR;
      }
      opportunityWhere.status = { notIn: INACTIVE_OPPORTUNITY_STATUSES };
    }

    if (Object.keys(opportunityWhere).length > 0) {
      where.opportunity = { is: opportunityWhere };
    }

    return where;
  }

  async findMatches(
    userId: string,
    dto: ListMatchesDto,
    limit: number,
    skip: number,
  ) {
    const where = this.buildWhere(userId, dto);
    const sortParam =
      (dto.sort as keyof typeof MATCH_SORT_TO_ORDER_BY) || 'score_desc';
    const orderBy = MATCH_SORT_TO_ORDER_BY[sortParam];

    try {
      const [data, total] = await Promise.all([
        this.aiPrisma.matchScore.findMany({
          where,
          orderBy,
          take: limit,
          skip,
          select: {
            opportunityId: true,
            scorePct: true,
            scoreBreakdown: true,
            calculationVersion: true,
            calculatedAt: true,
          },
        }),
        this.aiPrisma.matchScore.count({ where }),
      ]);
      return { data, total };
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async findMatchesWithOpportunity(
    userId: string,
    dto: ListMatchesDto,
    limit: number,
    skip: number,
  ) {
    const where = this.buildWhere(userId, dto);
    const sortParam =
      (dto.sort as keyof typeof MATCH_SORT_TO_ORDER_BY) || 'score_desc';
    const orderBy = MATCH_SORT_TO_ORDER_BY[sortParam];

    try {
      const [data, total] = await Promise.all([
        this.aiPrisma.matchScore.findMany({
          where,
          orderBy,
          take: limit,
          skip,
          select: {
            opportunityId: true,
            scorePct: true,
            scoreBreakdown: true,
            calculationVersion: true,
            calculatedAt: true,
            opportunity: {
              select: BRIEF_OPPORTUNITY_SELECT,
            },
          },
        }),
        this.aiPrisma.matchScore.count({ where }),
      ]);
      return { data, total };
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }
}
