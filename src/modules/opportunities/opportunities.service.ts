import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/ai-client';
import { ListOpportunitiesDto } from './dto/list-opportunities.dto';
import { OpportunitiesRepository } from './opportunities.repository';
import {
  OPPORTUNITY_FIELD_WHITELIST,
  OPPORTUNITY_DEFAULT_FIELDS,
  OPPORTUNITY_SORT_WHITELIST,
} from './dto/opportunity-fields.enum';

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(private readonly repository: OpportunitiesRepository) {}

  /**
   * Retrieves a paginated list of opportunities based on query parameters.
   *
   * @param dto - The ListOpportunitiesDto containing pagination, sorting, and filter params.
   * @returns An object containing the data array and pagination metadata.
   */
  async findMany(dto: ListOpportunitiesDto) {
    this.logger.debug('Fetching opportunities');
    const limit = Math.min(dto.limit ?? 20, 100);
    const page = dto.page ?? 1;
    const skip = (page - 1) * limit;

    // Field selection
    let selectedFields: readonly string[] = OPPORTUNITY_DEFAULT_FIELDS;
    if (dto.fields === '*') {
      selectedFields = OPPORTUNITY_FIELD_WHITELIST;
    } else if (dto.fields) {
      const parsedFields = dto.fields.split(',').map((f) => f.trim());
      for (const field of parsedFields) {
        if (
          !(OPPORTUNITY_FIELD_WHITELIST as readonly string[]).includes(field)
        ) {
          throw new BadRequestException('INVALID_FIELD');
        }
      }
      selectedFields = parsedFields;
    }

    const select: Record<string, boolean> = {};
    for (const field of selectedFields) {
      // Prisma schema uses camelCase names for fields mapping to DB snake_case columns.
      // We must convert the API snake_case field to Prisma camelCase field.
      const camelCaseField = field.replace(/_([a-z])/g, (g) =>
        g[1].toUpperCase(),
      );
      select[camelCaseField] = true;
    }

    // Sort parsing
    const sortParam = dto.sort || 'created_at:desc';
    const [sortField, sortOrder] = sortParam.split(':');

    if (
      !(OPPORTUNITY_SORT_WHITELIST as readonly string[]).includes(sortField)
    ) {
      throw new BadRequestException('INVALID_SORT_FIELD');
    }
    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
      throw new BadRequestException('VALIDATION_ERROR');
    }

    const camelCaseSortField = sortField.replace(/_([a-z])/g, (g) =>
      g[1].toUpperCase(),
    );
    const orderBy: Prisma.CleanedOpportunityOrderByWithRelationInput = {
      [camelCaseSortField]: sortOrder,
    };

    // Date validation
    if (dto.deadline_from && dto.deadline_to) {
      if (new Date(dto.deadline_from) > new Date(dto.deadline_to)) {
        throw new BadRequestException('INVALID_DATE_RANGE');
      }
    }

    // Where clause building
    const where: Prisma.CleanedOpportunityWhereInput = {};

    if (dto.country) {
      where.country = { equals: dto.country };
    }
    if (dto.opportunity_type) {
      where.opportunityType = { equals: dto.opportunity_type };
    }
    if (dto.funding_type) {
      where.fundingType = { equals: dto.funding_type };
    }
    if (dto.is_remote !== undefined) {
      where.isRemote = { equals: dto.is_remote };
    }
    if (dto.source_id) {
      where.sourceId = { equals: dto.source_id };
    }

    if (dto.deadline_from || dto.deadline_to) {
      where.deadline = {};
      if (dto.deadline_from) {
        where.deadline.gte = new Date(dto.deadline_from);
      }
      if (dto.deadline_to) {
        where.deadline.lte = new Date(dto.deadline_to);
      }
    }

    if (dto.study_levels) {
      const levels = dto.study_levels.split(',').map((s) => s.trim());
      where.studyLevels = { hasSome: levels };
    }

    if (dto.fields_of_study) {
      const fields = dto.fields_of_study.split(',').map((s) => s.trim());
      where.fieldsOfStudy = { hasSome: fields };
    }

    if (dto.q) {
      const qTrimmed = dto.q.trim();
      if (qTrimmed) {
        where.OR = [
          { title: { contains: qTrimmed, mode: 'insensitive' } },
          { description: { contains: qTrimmed, mode: 'insensitive' } },
        ];
      }
    }

    const { data, total } = await this.repository.findMany({
      skip,
      take: limit,
      where,
      orderBy,
      select,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a single opportunity by its ID.
   *
   * @param id - The UUID of the opportunity.
   * @param fields - Optional comma-separated fields to return.
   * @returns The opportunity object.
   */
  async findById(id: string, fields?: string) {
    let selectedFields: readonly string[] = OPPORTUNITY_FIELD_WHITELIST;
    if (fields === '*') {
      selectedFields = OPPORTUNITY_FIELD_WHITELIST;
    } else if (fields) {
      const parsedFields = fields.split(',').map((f) => f.trim());
      for (const field of parsedFields) {
        if (
          !(OPPORTUNITY_FIELD_WHITELIST as readonly string[]).includes(field)
        ) {
          throw new BadRequestException('INVALID_FIELD');
        }
      }
      selectedFields = parsedFields;
    }

    const select: Record<string, boolean> = {};
    for (const field of selectedFields) {
      const camelCaseField = field.replace(/_([a-z])/g, (g) =>
        g[1].toUpperCase(),
      );
      select[camelCaseField] = true;
    }

    const opportunity = await this.repository.findById({
      where: { id },
      select: select,
    });

    if (!opportunity) {
      throw new NotFoundException(
        'Opportunity not found',
        'OPPORTUNITY_NOT_FOUND',
      );
    }

    return opportunity;
  }
}
