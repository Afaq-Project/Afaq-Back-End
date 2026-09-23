import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { UpdateLanguageDto } from '../dto/update-language.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { buildMeta } from '../../../common/utils/paginate.util';

interface ProfileServiceWithRecalculate {
  recalculate?(userId: string): Promise<void>;
}

@Injectable()
export class LanguagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  async create(userId: string, data: CreateLanguageDto) {
    const existingCount = await this.prisma.userLanguages.count({
      where: { userId },
    });

    if (existingCount >= 5) {
      throw new BadRequestException('Cannot add more than 5 languages');
    }

    const languageMaster = await this.prisma.languagesMaster.findUnique({
      where: { id: data.languageId },
    });

    if (!languageMaster) {
      throw new BadRequestException('Language does not exist');
    }

    const existingLang = await this.prisma.userLanguages.findUnique({
      where: {
        userId_languageId: {
          userId,
          languageId: data.languageId,
        },
      },
    });

    if (existingLang) {
      throw new BadRequestException('Language already added');
    }

    const result = await this.prisma.userLanguages.create({
      data: {
        userId,
        languageId: data.languageId,
        proficiency: data.proficiency,
      } as import('@prisma/client').Prisma.UserLanguagesUncheckedCreateInput,
    });

    const profileSvc = this
      .profileService as unknown as ProfileServiceWithRecalculate;
    if (typeof profileSvc.recalculate === 'function') {
      await profileSvc.recalculate(userId);
    }

    return result;
  }

  async findAll(userId: string, dto: PaginationDto) {
    const [languages, total] = await Promise.all([
      this.prisma.userLanguages.findMany({
        where: { userId },
        skip: dto.skip,
        take: dto.limit,
        include: {
          language: { select: { nameEn: true } },
        },
      }),
      this.prisma.userLanguages.count({ where: { userId } }),
    ]);

    return {
      data: languages.map((l) => ({
        languageId: l.languageId,
        name: l.language?.nameEn,
        proficiency: l.proficiencyLevelId,
      })),
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async findOne(userId: string, languageId: string) {
    const lang = await this.prisma.userLanguages.findUnique({
      where: {
        userId_languageId: {
          userId,
          languageId,
        },
      },
      include: {
        language: true,
      },
    });

    if (!lang) {
      throw new NotFoundException('Language not found');
    }
    return lang;
  }

  async update(userId: string, languageId: string, data: UpdateLanguageDto) {
    await this.findOne(userId, languageId);

    if (data.languageId && data.languageId !== languageId) {
      const languageMaster = await this.prisma.languagesMaster.findUnique({
        where: { id: data.languageId },
      });

      if (!languageMaster) {
        throw new BadRequestException('Language does not exist');
      }

      const existingLang = await this.prisma.userLanguages.findUnique({
        where: {
          userId_languageId: {
            userId,
            languageId: data.languageId,
          },
        },
      });

      if (existingLang) {
        throw new BadRequestException('Language already added');
      }
    }

    const result = await this.prisma.userLanguages.update({
      where: {
        userId_languageId: {
          userId,
          languageId,
        },
      },
      data: {
        languageId: data.languageId,
        proficiency: data.proficiency,
      } as import('@prisma/client').Prisma.UserLanguagesUncheckedUpdateInput,
    });

    const profileSvc = this
      .profileService as unknown as ProfileServiceWithRecalculate;
    if (typeof profileSvc.recalculate === 'function') {
      await profileSvc.recalculate(userId);
    }

    return result;
  }

  async remove(userId: string, languageId: string) {
    await this.findOne(userId, languageId);

    await this.prisma.userLanguages.delete({
      where: {
        userId_languageId: {
          userId,
          languageId,
        },
      },
    });

    const profileSvc = this
      .profileService as unknown as ProfileServiceWithRecalculate;
    if (typeof profileSvc.recalculate === 'function') {
      await profileSvc.recalculate(userId);
    }
  }
}
