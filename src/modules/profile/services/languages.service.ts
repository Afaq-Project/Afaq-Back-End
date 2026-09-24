import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { UpdateLanguageDto } from '../dto/update-language.dto';

@Injectable()
export class LanguagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  async create(userId: string, data: CreateLanguageDto) {
    // 1. Verify language exists
    const language = await this.prisma.languagesMaster.findUnique({
      where: { id: data.languageId },
    });
    if (!language) {
      throw new BadRequestException({
        code: 'INVALID_LANGUAGE',
        message: 'Language not found',
      });
    }

    // 2. Verify proficiency level exists
    const proficiency = await this.prisma.proficiencyLevels.findUnique({
      where: { id: data.proficiencyLevelId },
    });
    if (!proficiency) {
      throw new BadRequestException({
        code: 'INVALID_PROFICIENCY_LEVEL',
        message: 'Proficiency level not found',
      });
    }

    // 3. Enforce MAX_LANGUAGES
    const settings = await this.prisma.systemSettings.findUnique({
      where: { key: 'profile.max_languages' },
    });
    const maxLanguages = settings?.value ? Number(settings.value) : 10;

    const count = await this.prisma.userLanguages.count({
      where: { userId },
    });

    if (count >= maxLanguages) {
      throw new BadRequestException(
        `Maximum languages allowed is ${maxLanguages}`,
      );
    }

    // 4. Check for duplicates
    const existing = await this.prisma.userLanguages.findUnique({
      where: {
        userId_languageId: {
          userId,
          languageId: data.languageId,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'LANGUAGE_DUPLICATE',
        message: 'Language already added to profile',
      });
    }

    // 5. Save
    const userLanguage = await this.prisma.userLanguages.create({
      data: {
        userId,
        languageId: data.languageId,
        proficiencyLevelId: data.proficiencyLevelId,
        isNative: data.isNative ?? false,
      },
      include: {
        language: { select: { nameEn: true, nameAr: true } },
        proficiencyLevel: { select: { nameEn: true, nameAr: true } },
      },
    });

    // 6. Recalculate profile completeness
    await this.profileService.recalculate(userId);

    return userLanguage;
  }

  async findAll(userId: string) {
    return this.prisma.userLanguages.findMany({
      where: { userId },
      include: {
        language: {
          select: { nameEn: true, nameAr: true },
        },
        proficiencyLevel: {
          select: { nameEn: true, nameAr: true },
        },
      },
    });
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
        language: {
          select: { nameEn: true, nameAr: true },
        },
        proficiencyLevel: {
          select: { nameEn: true, nameAr: true },
        },
      },
    });

    if (!lang) {
      throw new NotFoundException({
        code: 'LANGUAGE_NOT_FOUND',
        message: 'User language not found',
      });
    }
    return lang;
  }

  async update(userId: string, languageId: string, data: UpdateLanguageDto) {
    await this.findOne(userId, languageId);

    if (data.proficiencyLevelId) {
      const proficiency = await this.prisma.proficiencyLevels.findUnique({
        where: { id: data.proficiencyLevelId },
      });
      if (!proficiency) {
        throw new BadRequestException({
          code: 'INVALID_PROFICIENCY_LEVEL',
          message: 'Proficiency level not found',
        });
      }
    }

    const updated = await this.prisma.userLanguages.update({
      where: {
        userId_languageId: {
          userId,
          languageId,
        },
      },
      data: {
        ...(data.proficiencyLevelId && {
          proficiencyLevelId: data.proficiencyLevelId,
        }),
        ...(data.isNative !== undefined && { isNative: data.isNative }),
      },
    });

    await this.profileService.recalculate(userId);

    return updated;
  }

  async delete(userId: string, languageId: string) {
    await this.findOne(userId, languageId);

    await this.prisma.userLanguages.delete({
      where: {
        userId_languageId: {
          userId,
          languageId,
        },
      },
    });

    await this.profileService.recalculate(userId);
  }
}
