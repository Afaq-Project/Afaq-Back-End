import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';

import { SystemSettingsService } from './system-settings.service';
import { SystemSettingKeys } from '../constants/system-settings.keys';

@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async getAll(userId: string) {
    const [targetDegrees, targetMajors, targetInstitutions] = await Promise.all(
      [
        this.prisma.userTargetDegrees.findMany({ where: { userId } }),
        this.prisma.userTargetMajors.findMany({ where: { userId } }),
        this.prisma.userTargetInstitutions.findMany({ where: { userId } }),
      ],
    );

    return { targetDegrees, targetMajors, targetInstitutions };
  }

  async addDegree(userId: string, educationLevelId: string) {
    const level = await this.prisma.educationLevel.findUnique({
      where: { id: educationLevelId },
    });
    if (!level) {
      throw new BadRequestException({
        code: 'INVALID_EDUCATION_LEVEL',
        message: 'Invalid education level',
      });
    }

    const maxTargetDegrees = await this.systemSettingsService.getNumber(
      SystemSettingKeys.MAX_TARGET_DEGREES,
      5,
    );
    const count = await this.prisma.userTargetDegrees.count({
      where: { userId },
    });
    if (count >= maxTargetDegrees) {
      const existing = await this.prisma.userTargetDegrees.findUnique({
        where: { userId_educationLevelId: { userId, educationLevelId } },
      });
      if (!existing) {
        throw new ConflictException('MAX_TARGET_DEGREES_REACHED');
      }
    }

    await this.prisma.userTargetDegrees.upsert({
      where: { userId_educationLevelId: { userId, educationLevelId } },
      create: { userId, educationLevelId },
      update: {},
    });
    await this.profileService.recalculate(userId);
  }

  async removeDegree(userId: string, educationLevelId: string) {
    const existing = await this.prisma.userTargetDegrees.findUnique({
      where: { userId_educationLevelId: { userId, educationLevelId } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'TARGET_DEGREE_NOT_FOUND',
        message: 'Target degree not found',
      });
    }

    await this.prisma.userTargetDegrees.delete({
      where: { userId_educationLevelId: { userId, educationLevelId } },
    });
    await this.profileService.recalculate(userId);
  }

  async addMajor(userId: string, majorId: string) {
    const major = await this.prisma.majors.findUnique({
      where: { id: majorId },
    });
    if (!major) {
      throw new BadRequestException({
        code: 'INVALID_MAJOR',
        message: 'Invalid major',
      });
    }

    const maxTargetMajors = await this.systemSettingsService.getNumber(
      SystemSettingKeys.MAX_TARGET_MAJORS,
      10,
    );
    const count = await this.prisma.userTargetMajors.count({
      where: { userId },
    });
    if (count >= maxTargetMajors) {
      const existing = await this.prisma.userTargetMajors.findUnique({
        where: { userId_majorId: { userId, majorId } },
      });
      if (!existing) {
        throw new ConflictException('MAX_TARGET_MAJORS_REACHED');
      }
    }

    await this.prisma.userTargetMajors.upsert({
      where: { userId_majorId: { userId, majorId } },
      create: { userId, majorId },
      update: {},
    });
    await this.profileService.recalculate(userId);
  }

  async removeMajor(userId: string, majorId: string) {
    const existing = await this.prisma.userTargetMajors.findUnique({
      where: { userId_majorId: { userId, majorId } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'TARGET_MAJOR_NOT_FOUND',
        message: 'Target major not found',
      });
    }

    await this.prisma.userTargetMajors.delete({
      where: { userId_majorId: { userId, majorId } },
    });
    await this.profileService.recalculate(userId);
  }

  async addInstitution(userId: string, institutionId: string) {
    const institution = await this.prisma.institutions.findUnique({
      where: { id: institutionId },
    });
    if (!institution) {
      throw new BadRequestException({
        code: 'INVALID_INSTITUTION',
        message: 'Invalid institution',
      });
    }

    const maxTargetInstitutions = await this.systemSettingsService.getNumber(
      SystemSettingKeys.MAX_TARGET_INSTITUTIONS,
      10,
    );
    const count = await this.prisma.userTargetInstitutions.count({
      where: { userId },
    });
    if (count >= maxTargetInstitutions) {
      const existing = await this.prisma.userTargetInstitutions.findUnique({
        where: { userId_institutionId: { userId, institutionId } },
      });
      if (!existing) {
        throw new ConflictException('MAX_TARGET_INSTITUTIONS_REACHED');
      }
    }

    await this.prisma.userTargetInstitutions.upsert({
      where: { userId_institutionId: { userId, institutionId } },
      create: { userId, institutionId },
      update: {},
    });
    await this.profileService.recalculate(userId);
  }

  async removeInstitution(userId: string, institutionId: string) {
    const existing = await this.prisma.userTargetInstitutions.findUnique({
      where: { userId_institutionId: { userId, institutionId } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'TARGET_INSTITUTION_NOT_FOUND',
        message: 'Target institution not found',
      });
    }

    await this.prisma.userTargetInstitutions.delete({
      where: { userId_institutionId: { userId, institutionId } },
    });
    await this.profileService.recalculate(userId);
  }
}
