// Batch 3 (T050) will rewrite this service entirely.
// create/update are disabled — their endpoints are commented out in profile.module.ts.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { UpdateLanguageDto } from '../dto/update-language.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { buildMeta } from '../../../common/utils/paginate.util';

@Injectable()
export class LanguagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async create(userId: string, data: CreateLanguageDto): Promise<never> {
    void userId;
    void data; // bypass TS6133
    // TODO(T050): full rewrite in Batch 3
    throw new Error('LanguagesService is disabled until Batch 3 (T050)');
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

  // eslint-disable-next-line @typescript-eslint/require-await
  async update(
    userId: string,
    languageId: string,
    data: UpdateLanguageDto,
  ): Promise<never> {
    void userId;
    void languageId;
    void data; // bypass TS6133
    // TODO(T050): full rewrite in Batch 3
    throw new Error('LanguagesService is disabled until Batch 3 (T050)');
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

    await this.profileService.recalculate(userId);
  }
}
