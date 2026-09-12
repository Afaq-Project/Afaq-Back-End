import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LanguagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  async getLanguages(userId: string) {
    return this.prisma.userLanguages.findMany({
      where: { userId },
      include: { language: true },
    });
  }

  async addLanguage(userId: string, data: CreateLanguageDto) {
    const count = await this.prisma.userLanguages.count({ where: { userId } });
    if (count >= 5) {
      throw new BadRequestException('Maximum 5 languages allowed');
    }

    const master = await this.prisma.languagesMaster.findUnique({
      where: { id: data.languageId },
    });
    if (!master) {
      throw new BadRequestException('The selected item is invalid.');
    }

    try {
      const created = await this.prisma.userLanguages.create({
        data: {
          userId,
          languageId: data.languageId,
          proficiency: data.proficiency,
        },
      });
      await this.profileService.recalculateProfileStatus(userId);
      return created;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'This item has already been added to your profile.',
        );
      }
      throw err;
    }
  }

  async removeLanguage(userId: string, languageId: string) {
    await this.prisma.userLanguages.delete({
      where: { userId_languageId: { userId, languageId } },
    });
    await this.profileService.recalculateProfileStatus(userId);
  }
}
