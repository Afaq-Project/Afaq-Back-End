import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEducationDto } from '../dto/create-education.dto';
import { UpdateEducationDto } from '../dto/update-education.dto';
import { ProfileService } from './profile.service';
import { Prisma } from '@prisma/client';
import { normalizeGPA } from '../../../common/utils/gpa-normalizer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { buildMeta } from '../../../common/utils/paginate.util';

@Injectable()
export class EducationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatEducation(edu: any) {
    if (!edu) {
      return edu;
    }
    return {
      ...edu,
      gpaRawScale:
        edu.gpaRawScale !== null && edu.gpaRawScale !== undefined
          ? Number.isInteger(Number(edu.gpaRawScale))
            ? Number(edu.gpaRawScale).toFixed(1)
            : String(edu.gpaRawScale)
          : null,
    };
  }

  async create(userId: string, data: CreateEducationDto) {
    // TODO(T039): full rewrite in Batch 2
    throw new Error('EducationsService is disabled until Batch 2 (T039)');

    const education = await this.prisma.userEducations.create({
      // @ts-expect-error Mismatched types
      data: {
        userId,
        ...data,
      },
    });

    await this.profileService.updateProfile(userId, {});

    return this.formatEducation(education);
  }

  async findAll(userId: string, dto: PaginationDto) {
    const [educations, total] = await Promise.all([
      this.prisma.userEducations.findMany({
        where: { userId },
        skip: dto.skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userEducations.count({ where: { userId } }),
    ]);

    return {
      data: educations.map((edu) => this.formatEducation(edu)),
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async update(userId: string, id: string, data: UpdateEducationDto) {
    // TODO(T039): full rewrite in Batch 2
    throw new Error('EducationsService is disabled until Batch 2 (T039)');

    const existing = await this.prisma.userEducations.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Education record not found');
    }

    const updateData: Prisma.UserEducationsUpdateInput = {
      degree: data.degree,
      // @ts-expect-error Mismatched types
      major: data.major,
      // @ts-expect-error Mismatched types
      institution: data.institution,
      graduationYear: data.graduationYear,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      const k = key as keyof Prisma.UserEducationsUpdateInput;
      if (updateData[k] === undefined) {
        delete updateData[k];
      }
    });

    if (data.gpaScale !== undefined) {
      if (data.gpaScale === 'letter') {
        updateData.gpaRaw = null;
        updateData.gpaScale = null;
        updateData.gpaNormalized = data.gpaValue
          ? normalizeGPA(data.gpaValue as number, 'letter')
          : null;
      } else {
        if (data.gpaValue !== undefined && data.gpaValue !== null) {
          updateData.gpaRaw = data.gpaValue;

          if (data.gpaScale === '4.0') {
            updateData.gpaScale = 'OUT_OF_4';
          } else if (data.gpaScale === 'percentage') {
            updateData.gpaScale = 'OUT_OF_100';
          }
          updateData.gpaNormalized = normalizeGPA(
            data.gpaValue as number,
            data.gpaScale as '4.0' | 'percentage' | 'letter',
          );
        }
      }
    } else if (data.gpaValue !== undefined && data.gpaValue !== null) {
      updateData.gpaRaw = data.gpaValue;
    }

    const updated = await this.prisma.userEducations.update({
      where: { id, userId },
      data: updateData,
    });

    return this.formatEducation(updated);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.userEducations.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Education record not found');
    }

    await this.prisma.userEducations.delete({
      where: { id, userId },
    });

    await this.profileService.updateProfile(userId, {});
  }
}
