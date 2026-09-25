import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { CreateSpecialStatusDto } from '../dto/create-special-status.dto';

@Injectable()
export class SpecialStatusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  async add(userId: string, dto: CreateSpecialStatusDto) {
    const statusExists = await this.prisma.specialStatuses.findUnique({
      where: { id: dto.specialStatusId },
    });

    if (!statusExists) {
      throw new BadRequestException({
        code: 'INVALID_SPECIAL_STATUS',
        message: 'Invalid special status',
      });
    }

    await this.prisma.userSpecialStatuses.upsert({
      where: {
        userId_specialStatusId: {
          userId,
          specialStatusId: dto.specialStatusId,
        },
      },
      update: {},
      create: {
        userId,
        specialStatusId: dto.specialStatusId,
      },
    });

    await this.profileService.recalculate(userId);
    return { success: true };
  }

  async findAll(userId: string) {
    const statuses = await this.prisma.userSpecialStatuses.findMany({
      where: { userId },
      include: {
        status: {
          select: {
            nameEn: true,
            nameAr: true,
          },
        },
      },
    });

    return statuses.map((s) => {
      const { status, ...rest } = s;
      return {
        ...rest,
        specialStatus: status,
      };
    });
  }

  async remove(userId: string, specialStatusId: string) {
    try {
      await this.prisma.userSpecialStatuses.delete({
        where: {
          userId_specialStatusId: {
            userId,
            specialStatusId,
          },
        },
      });
    } catch {
      throw new NotFoundException({
        code: 'SPECIAL_STATUS_NOT_FOUND',
        message: 'Special status not found',
      });
    }

    await this.profileService.recalculate(userId);
    return { success: true };
  }
}
