import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { buildMeta } from '../../../common/utils/paginate.util';
import { APP_LANGUAGES } from '../constants/app-languages.constant';

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getLanguages(dto: PaginationDto) {
    const where = dto.search
      ? { name: { contains: dto.search, mode: 'insensitive' as const } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.languagesMaster.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.languagesMaster.count({ where }),
    ]);

    return {
      data,
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async getFieldsOfStudy(dto: PaginationDto & { category?: string }) {
    const where: Prisma.FieldOfStudyWhereInput = { isActive: true };

    if (dto.search) {
      where.name = { contains: dto.search, mode: 'insensitive' };
    }

    if (dto.category) {
      where.category = dto.category;
    }

    const [data, total] = await Promise.all([
      this.prisma.fieldOfStudy.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          name: true,
          category: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.fieldOfStudy.count({ where }),
    ]);

    return {
      data,
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async getSkillsTaxonomy(dto: PaginationDto & { category?: string }) {
    if (!dto.search && !dto.category && dto.page === 1 && dto.limit === 50) {
      const skills = await this.prisma.skillsMaster.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          category: true,
        },
        orderBy: { name: 'asc' },
      });

      const taxonomy = skills.reduce(
        (acc, skill) => {
          const { category, ...rest } = skill;
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(rest);
          return acc;
        },
        {} as Record<string, { id: string; name: string }[]>,
      );

      const data = Object.entries(taxonomy).map(
        ([category, categorySkills]) => ({
          category,
          skills: categorySkills,
        }),
      );

      return {
        data,
        meta: {
          pagination: null,
        },
      };
    }

    const where: Prisma.SkillsMasterWhereInput = { isActive: true };
    if (dto.search) {
      where.name = { contains: dto.search, mode: 'insensitive' };
    }
    if (dto.category) {
      where.category = dto.category;
    }

    const [data, total] = await Promise.all([
      this.prisma.skillsMaster.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          name: true,
          category: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.skillsMaster.count({ where }),
    ]);

    return {
      data,
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async getEducationLevels() {
    const data = await this.prisma.educationLevel.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        labelEn: true,
        labelAr: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    return data;
  }

  getAppLanguages() {
    return APP_LANGUAGES;
  }
}
