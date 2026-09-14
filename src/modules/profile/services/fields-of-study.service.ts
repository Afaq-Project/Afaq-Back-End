import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { CreateFieldOfStudyDto } from '../dto/create-field-of-study.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class FieldsOfStudyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  async getFields(userId: string) {
    return this.prisma.userFieldsOfStudy.findMany({
      where: { userId },
      include: { field: true },
    });
  }

  async addField(userId: string, data: CreateFieldOfStudyDto) {
    const count = await this.prisma.userFieldsOfStudy.count({
      where: { userId },
    });
    if (count >= 5) {
      throw new BadRequestException('Maximum 5 fields of study allowed');
    }

    const master = await this.prisma.fieldOfStudy.findUnique({
      where: { id: data.fieldId },
    });
    if (!master || !master.isActive) {
      throw new BadRequestException(
        'The selected item is invalid or inactive.',
      );
    }

    try {
      const created = await this.prisma.userFieldsOfStudy.create({
        data: { userId, fieldId: data.fieldId },
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

  async removeField(userId: string, fieldId: string) {
    try {
      await this.prisma.userFieldsOfStudy.delete({
        where: { userId_fieldId: { userId, fieldId } },
      });
      await this.profileService.recalculateProfileStatus(userId);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Field of study not found in profile.');
      }
      throw err;
    }
  }
}
