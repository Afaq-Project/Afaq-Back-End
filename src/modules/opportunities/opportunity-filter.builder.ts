import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/ai-client';
import { ListOpportunitiesDto } from './dto/list-opportunities.dto';

/**
 * Builds a Prisma Where clause for filtering opportunities.
 * Can be reused across modules that need to apply opportunity filters.
 */
export function buildOpportunityWhere(
  dto: Partial<ListOpportunitiesDto>,
): Prisma.CleanedOpportunityWhereInput {
  if (dto.deadline_from && dto.deadline_to) {
    if (new Date(dto.deadline_from) > new Date(dto.deadline_to)) {
      throw new BadRequestException(
        `deadline_from must not be later than deadline_to`,
        'INVALID_DATE_RANGE',
      );
    }
  }

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
    const levels = dto.study_levels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    where.studyLevels = { hasSome: levels };
  }

  if (dto.fields_of_study) {
    const fields = dto.fields_of_study
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
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

  return where;
}
