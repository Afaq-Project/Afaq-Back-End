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

  async create(userId: string, data: CreateEducationDto) {
    const education = await this.prisma.userEducations.create({
      data: {
        userId,
        ...data,
      },
    });

    await this.profileService.updateProfile(userId, {});

    return education;
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
      data: educations,
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async update(userId: string, id: string, data: UpdateEducationDto) {
    const existing = await this.prisma.userEducations.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Education record not found');
    }

    const updateData: Prisma.UserEducationsUpdateInput = {
      degree: data.degree,
      major: data.major,
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
        updateData.gpaRawScale = null;
        updateData.gpaNormalized4 = data.gpaValue
          ? normalizeGPA(data.gpaValue, 'letter')
          : null;
      } else {
        if (data.gpaValue !== undefined && data.gpaValue !== null) {
          updateData.gpaRaw = data.gpaValue;

          if (data.gpaScale === '4.0') {
            updateData.gpaRawScale = 4.0;
          } else if (data.gpaScale === 'percentage') {
            updateData.gpaRawScale = 100.0;
          }
          updateData.gpaNormalized4 = normalizeGPA(
            data.gpaValue,
            data.gpaScale,
          );
        }
      }
    } else if (data.gpaValue !== undefined && data.gpaValue !== null) {
      updateData.gpaRaw = data.gpaValue;
    }

    return this.prisma.userEducations.update({
      where: { id, userId },
      data: updateData,
    });
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
