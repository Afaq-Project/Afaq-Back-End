import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { GetCountriesDto } from '../dto/get-countries.dto';
import { GetCitiesDto } from '../dto/get-cities.dto';

import { GetMajorCategoriesDto } from '../dto/get-major-categories.dto';
import { GetMajorsDto } from '../dto/get-majors.dto';
import { GetInstitutionsDto } from '../dto/get-institutions.dto';
import { buildMeta } from '../../../common/utils/paginate.util';
import { APP_LANGUAGES } from '../constants/app-languages.constant';

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getLanguages(dto: PaginationDto) {
    const where = dto.search
      ? { nameEn: { contains: dto.search, mode: 'insensitive' as const } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.languagesMaster.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        select: { id: true, nameEn: true, nameAr: true, isoCode: true },
        orderBy: { nameEn: 'asc' },
      }),
      this.prisma.languagesMaster.count({ where }),
    ]);

    return {
      data,
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  getProficiencyLevels() {
    return this.prisma.proficiencyLevels.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getCountries(dto: GetCountriesDto) {
    const conditions: Prisma.CountriesWhereInput[] = [{ isActive: true }];
    if (dto.search) {
      conditions.push({
        OR: [
          { nameEn: { contains: dto.search, mode: 'insensitive' } },
          { nameAr: { contains: dto.search, mode: 'insensitive' } },
          { isoCode: { contains: dto.search, mode: 'insensitive' } },
          { isoCode2: { contains: dto.search, mode: 'insensitive' } },
        ],
      });
    }
    if (dto.region) {
      conditions.push({
        OR: [
          { regionEn: { equals: dto.region, mode: 'insensitive' } },
          { regionAr: { equals: dto.region, mode: 'insensitive' } },
        ],
      });
    }

    const sortField = dto.sort ?? 'nameEn';
    const orderBy = { [sortField]: dto.order ?? 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.countries.findMany({
        where: { AND: conditions },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          nationalityNameEn: true,
          nationalityNameAr: true,
          isoCode: true,
          isoCode2: true,
          regionEn: true,
          regionAr: true,
        },
        orderBy,
      }),
      this.prisma.countries.count({ where: { AND: conditions } }),
    ]);

    return {
      data,
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async getCities(dto: GetCitiesDto) {
    const conditions: Prisma.CitiesWhereInput[] = [{ isActive: true }];
    if (dto.countryId) {
      conditions.push({ countryId: dto.countryId });
    }
    if (dto.search) {
      conditions.push({
        OR: [
          { nameEn: { contains: dto.search, mode: 'insensitive' } },
          { nameAr: { contains: dto.search, mode: 'insensitive' } },
        ],
      });
    }

    const sortField = dto.sort ?? 'nameEn';
    const orderBy = { [sortField]: dto.order ?? 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.cities.findMany({
        where: { AND: conditions },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          countryId: true,
        },
        orderBy,
      }),
      this.prisma.cities.count({ where: { AND: conditions } }),
    ]);

    return {
      data,
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async getMaritalStatuses() {
    return this.prisma.maritalStatuses.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getEducationLevels() {
    return this.prisma.educationLevel.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        nameEn: true,
        nameAr: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  getAppLanguages() {
    return APP_LANGUAGES;
  }

  async getMajorCategories(dto: GetMajorCategoriesDto) {
    const conditions: Prisma.MajorCategoriesWhereInput[] = [{ isActive: true }];
    if (dto.search) {
      conditions.push({
        OR: [
          { nameEn: { contains: dto.search, mode: 'insensitive' } },
          { nameAr: { contains: dto.search, mode: 'insensitive' } },
        ],
      });
    }

    const sortField = dto.sort ?? 'nameEn';
    const orderBy = { [sortField]: dto.order ?? 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.majorCategories.findMany({
        where: { AND: conditions },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
        },
        orderBy,
      }),
      this.prisma.majorCategories.count({ where: { AND: conditions } }),
    ]);

    return {
      data,
      meta: {
        total,
        ...buildMeta(total, dto.page, dto.limit),
      },
    };
  }

  async getMajors(dto: GetMajorsDto) {
    const conditions: Prisma.MajorsWhereInput[] = [{ isActive: true }];
    if (dto.categoryId) {
      conditions.push({ categoryId: dto.categoryId });
    }
    if (dto.search) {
      conditions.push({
        OR: [
          { nameEn: { contains: dto.search, mode: 'insensitive' } },
          { nameAr: { contains: dto.search, mode: 'insensitive' } },
        ],
      });
    }

    const sortField = dto.sort ?? 'nameEn';
    const orderBy = { [sortField]: dto.order ?? 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.majors.findMany({
        where: { AND: conditions },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          categoryId: true,
        },
        orderBy,
      }),
      this.prisma.majors.count({ where: { AND: conditions } }),
    ]);

    return {
      data,
      meta: {
        total,
        ...buildMeta(total, dto.page, dto.limit),
      },
    };
  }

  async getInstitutions(dto: GetInstitutionsDto) {
    const conditions: Prisma.InstitutionsWhereInput[] = [{ isActive: true }];
    if (dto.countryId) {
      conditions.push({ countryId: dto.countryId });
    }
    if (dto.cityId) {
      conditions.push({ cityId: dto.cityId });
    }
    if (dto.search) {
      conditions.push({
        OR: [
          { nameEn: { contains: dto.search, mode: 'insensitive' } },
          { nameAr: { contains: dto.search, mode: 'insensitive' } },
        ],
      });
    }

    const sortField = dto.sort ?? 'nameEn';
    const orderBy = { [sortField]: dto.order ?? 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.institutions.findMany({
        where: { AND: conditions },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          countryId: true,
          cityId: true,
        },
        orderBy,
      }),
      this.prisma.institutions.count({ where: { AND: conditions } }),
    ]);

    return {
      data,
      meta: {
        total,
        ...buildMeta(total, dto.page, dto.limit),
      },
    };
  }

  async getStandardizedTests() {
    return this.prisma.standardizedTests.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        minScore: true,
        maxScore: true,
        scoreStep: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getSpecialStatuses() {
    return this.prisma.specialStatuses.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
      },
    });
  }

  async getDocumentTypes() {
    return this.prisma.documentTypes.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
      },
    });
  }
}
