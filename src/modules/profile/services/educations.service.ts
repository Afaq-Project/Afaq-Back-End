import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEducationDto } from '../dto/create-education.dto';
import { UpdateEducationDto } from '../dto/update-education.dto';
import { ProfileService } from './profile.service';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { buildMeta } from '../../../common/utils/paginate.util';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingKeys } from '../constants/system-settings.keys';
import { GpaScale, UserEducations } from '@prisma/client';

@Injectable()
export class EducationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  private formatEducation(
    edu: UserEducations & {
      educationLevel?: Record<string, unknown>;
      institution?: Record<string, unknown>;
      major?: Record<string, unknown>;
      minorMajor?: Record<string, unknown> | null;
    },
  ) {
    if (!edu) {
      return edu;
    }
    return {
      ...edu,
      startDate: edu.startDate
        ? edu.startDate.toISOString().split('T')[0]
        : null,
      endDate: edu.endDate ? edu.endDate.toISOString().split('T')[0] : null,
      expectedGraduationDate: edu.expectedGraduationDate
        ? edu.expectedGraduationDate.toISOString().split('T')[0]
        : null,
    };
  }

  /**
   * Normalizes GPA to a 4.0 scale based on the provided scale.
   * OUT_OF_4: raw
   * OUT_OF_5: raw * 4 / 5
   * OUT_OF_100: raw * 4 / 100
   */
  private calculateNormalizedGpa(
    gpaRaw?: number | null,
    gpaScale?: GpaScale | null,
  ): number | null {
    if (gpaRaw === undefined || gpaRaw === null || !gpaScale) {
      return null;
    }
    const raw = Number(gpaRaw);
    if (gpaScale === GpaScale.OUT_OF_4) {
      return raw;
    }
    if (gpaScale === GpaScale.OUT_OF_5) {
      return (raw * 4) / 5;
    }
    if (gpaScale === GpaScale.OUT_OF_100) {
      return (raw * 4) / 100;
    }
    return null;
  }

  private async checkFks(data: {
    educationLevelId?: string;
    institutionId?: string;
    majorId?: string;
    minorMajorId?: string;
  }) {
    if (data.educationLevelId) {
      const level = await this.prisma.educationLevel.findUnique({
        where: { id: data.educationLevelId },
      });
      if (!level) {
        throw new BadRequestException({
          code: 'INVALID_EDUCATION_LEVEL',
          message: 'INVALID_EDUCATION_LEVEL',
        });
      }
    }
    if (data.institutionId) {
      const inst = await this.prisma.institutions.findUnique({
        where: { id: data.institutionId },
      });
      if (!inst) {
        throw new BadRequestException({
          code: 'INVALID_INSTITUTION',
          message: 'INVALID_INSTITUTION',
        });
      }
    }
    if (data.majorId) {
      const maj = await this.prisma.majors.findUnique({
        where: { id: data.majorId },
      });
      if (!maj) {
        throw new BadRequestException({
          code: 'INVALID_MAJOR',
          message: 'INVALID_MAJOR',
        });
      }
    }
    if (data.minorMajorId) {
      const min = await this.prisma.majors.findUnique({
        where: { id: data.minorMajorId },
      });
      if (!min) {
        throw new BadRequestException({
          code: 'INVALID_MINOR_MAJOR',
          message: 'INVALID_MINOR_MAJOR',
        });
      }
    }
  }

  async create(userId: string, data: CreateEducationDto) {
    if (data.minorMajorId && data.minorMajorId === data.majorId) {
      throw new BadRequestException({
        code: 'MINOR_MAJOR_EQUALS_MAJOR',
        message: 'MINOR_MAJOR_EQUALS_MAJOR',
      });
    }

    const { startDate } = data;
    let { endDate, expectedGraduationDate } = data;
    if (data.isCurrent) {
      endDate = undefined;
    } else if (data.isCurrent === false) {
      expectedGraduationDate = undefined;
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'INVALID_DATE_RANGE',
      });
    }

    await this.checkFks(data);

    const existing = await this.prisma.userEducations.findFirst({
      where: {
        userId,
        educationLevelId: data.educationLevelId,
        institutionId: data.institutionId,
        majorId: data.majorId,
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'EDUCATION_DUPLICATE',
        message: 'EDUCATION_DUPLICATE',
      });
    }

    const maxEducations = await this.systemSettingsService.getNumber(
      SystemSettingKeys.MAX_EDUCATIONS,
      5,
    );
    const count = await this.prisma.userEducations.count({ where: { userId } });
    if (count >= maxEducations) {
      throw new ConflictException({
        code: 'MAX_EDUCATIONS_REACHED',
        message: 'MAX_EDUCATIONS_REACHED',
      });
    }

    if (data.gpaRaw !== undefined && data.gpaRaw !== null && !data.gpaScale) {
      throw new BadRequestException({
        code: 'GPA_SCALE_REQUIRED',
        message: 'GPA_SCALE_REQUIRED',
      });
    }

    const gpaNormalized = this.calculateNormalizedGpa(
      data.gpaRaw,
      data.gpaScale,
    );

    const edu = await this.prisma.userEducations.create({
      data: {
        userId,
        educationLevelId: data.educationLevelId,
        institutionId: data.institutionId,
        majorId: data.majorId,
        minorMajorId: data.minorMajorId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        expectedGraduationDate: expectedGraduationDate
          ? new Date(expectedGraduationDate)
          : null,
        isCurrent: data.isCurrent ?? false,
        gpaRaw: data.gpaRaw,
        gpaScale: data.gpaScale,
        gpaNormalized: gpaNormalized,
      },
      include: {
        educationLevel: true,
        institution: true,
        major: true,
        minorMajor: true,
      },
    });

    await this.profileService.recalculate(userId);
    return this.formatEducation(edu);
  }

  async findAll(userId: string, dto: PaginationDto) {
    const [educations, total] = await Promise.all([
      this.prisma.userEducations.findMany({
        where: { userId },
        skip: dto.skip,
        take: dto.limit,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          educationLevel: true,
          institution: true,
          major: true,
          minorMajor: true,
        },
      }),
      this.prisma.userEducations.count({ where: { userId } }),
    ]);

    return {
      data: educations.map((edu) => this.formatEducation(edu)),
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async findOne(userId: string, id: string) {
    const edu = await this.prisma.userEducations.findFirst({
      where: { userId, id },
      include: {
        educationLevel: true,
        institution: true,
        major: true,
        minorMajor: true,
      },
    });
    if (!edu) {
      throw new NotFoundException({
        code: 'EDUCATION_NOT_FOUND',
        message: 'EDUCATION_NOT_FOUND',
      });
    }
    return this.formatEducation(edu);
  }

  async update(userId: string, id: string, data: UpdateEducationDto) {
    const edu = await this.prisma.userEducations.findFirst({
      where: { userId, id },
    });
    if (!edu) {
      throw new NotFoundException({
        code: 'EDUCATION_NOT_FOUND',
        message: 'EDUCATION_NOT_FOUND',
      });
    }

    const major = data.majorId !== undefined ? data.majorId : edu.majorId;
    const minor =
      data.minorMajorId !== undefined ? data.minorMajorId : edu.minorMajorId;
    if (minor && major === minor) {
      throw new BadRequestException({
        code: 'MINOR_MAJOR_EQUALS_MAJOR',
        message: 'MINOR_MAJOR_EQUALS_MAJOR',
      });
    }

    await this.checkFks(data);

    if (data.educationLevelId || data.institutionId || data.majorId) {
      const levelId = data.educationLevelId ?? edu.educationLevelId;
      const instId = data.institutionId ?? edu.institutionId;
      const majId = data.majorId ?? edu.majorId;

      const existing = await this.prisma.userEducations.findFirst({
        where: {
          userId,
          educationLevelId: levelId,
          institutionId: instId,
          majorId: majId,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException({
          code: 'EDUCATION_DUPLICATE',
          message: 'EDUCATION_DUPLICATE',
        });
      }
    }

    const isCurrent =
      data.isCurrent !== undefined ? data.isCurrent : edu.isCurrent;
    let endDateRaw =
      data.endDate !== undefined ? data.endDate : edu.endDate?.toISOString();
    let expectedGraduationDateRaw =
      data.expectedGraduationDate !== undefined
        ? data.expectedGraduationDate
        : edu.expectedGraduationDate?.toISOString();

    if (isCurrent) {
      endDateRaw = undefined;
    } else if (isCurrent === false) {
      expectedGraduationDateRaw = undefined;
    }

    const sd =
      data.startDate !== undefined
        ? data.startDate
        : edu.startDate?.toISOString();
    if (sd && endDateRaw && new Date(endDateRaw) < new Date(sd)) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'INVALID_DATE_RANGE',
      });
    }

    const gpaRaw =
      data.gpaRaw !== undefined
        ? data.gpaRaw
        : edu.gpaRaw
          ? Number(edu.gpaRaw)
          : null;
    const gpaScale = data.gpaScale !== undefined ? data.gpaScale : edu.gpaScale;

    if (gpaRaw !== undefined && gpaRaw !== null && !gpaScale) {
      throw new BadRequestException({
        code: 'GPA_SCALE_REQUIRED',
        message: 'GPA_SCALE_REQUIRED',
      });
    }

    const gpaNormalized = this.calculateNormalizedGpa(gpaRaw, gpaScale);

    const updated = await this.prisma.userEducations.update({
      where: { id },
      data: {
        educationLevelId: data.educationLevelId,
        institutionId: data.institutionId,
        majorId: data.majorId,
        minorMajorId: data.minorMajorId === null ? null : data.minorMajorId,
        startDate:
          data.startDate !== undefined
            ? data.startDate
              ? new Date(data.startDate)
              : null
            : undefined,
        endDate: endDateRaw ? new Date(endDateRaw) : null,
        expectedGraduationDate: expectedGraduationDateRaw
          ? new Date(expectedGraduationDateRaw)
          : null,
        isCurrent: isCurrent,
        gpaRaw: data.gpaRaw,
        gpaScale: data.gpaScale === null ? null : data.gpaScale,
        gpaNormalized: gpaNormalized,
      },
      include: {
        educationLevel: true,
        institution: true,
        major: true,
        minorMajor: true,
      },
    });

    await this.profileService.recalculate(userId);
    return this.formatEducation(updated);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.userEducations.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'EDUCATION_NOT_FOUND',
        message: 'EDUCATION_NOT_FOUND',
      });
    }

    await this.prisma.userEducations.delete({
      where: { id },
    });

    await this.profileService.recalculate(userId);
  }
}
