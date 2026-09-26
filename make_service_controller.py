import os

service_content = """import {
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

  private formatEducation(edu: UserEducations) {
    if (!edu) return edu;
    return edu;
  }

  private calculateNormalizedGpa(gpaRaw?: number | null, gpaScale?: GpaScale | null): number | null {
    if (gpaRaw === undefined || gpaRaw === null || !gpaScale) {
      return null;
    }
    const raw = Number(gpaRaw);
    if (gpaScale === GpaScale.OUT_OF_4) return raw;
    if (gpaScale === GpaScale.OUT_OF_5) return raw * 0.8;
    if (gpaScale === GpaScale.OUT_OF_100) return raw / 25;
    return null;
  }

  private async checkFks(data: { educationLevelId?: string; institutionId?: string; majorId?: string; minorMajorId?: string }) {
    if (data.educationLevelId) {
      const level = await this.prisma.educationLevels.findUnique({ where: { id: data.educationLevelId } });
      if (!level) throw new BadRequestException('educationLevelId is invalid');
    }
    if (data.institutionId) {
      const inst = await this.prisma.institutions.findUnique({ where: { id: data.institutionId } });
      if (!inst) throw new BadRequestException('institutionId is invalid');
    }
    if (data.majorId) {
      const maj = await this.prisma.majors.findUnique({ where: { id: data.majorId } });
      if (!maj) throw new BadRequestException('majorId is invalid');
    }
    if (data.minorMajorId) {
      const min = await this.prisma.majors.findUnique({ where: { id: data.minorMajorId } });
      if (!min) throw new BadRequestException('minorMajorId is invalid');
    }
  }

  async create(userId: string, data: CreateEducationDto) {
    if (data.minorMajorId && data.minorMajorId === data.majorId) {
      throw new BadRequestException('minorMajorId cannot be the same as majorId');
    }

    const maxEducations = await this.systemSettingsService.getNumber(SystemSettingKeys.MAX_EDUCATIONS);
    const count = await this.prisma.userEducations.count({ where: { userId } });
    if (count >= maxEducations) {
      throw new BadRequestException(`Maximum of ${maxEducations} educations reached`);
    }

    const existing = await this.prisma.userEducations.findFirst({
      where: {
        userId,
        educationLevelId: data.educationLevelId,
        institutionId: data.institutionId,
        majorId: data.majorId,
      }
    });
    if (existing) {
      throw new ConflictException('Education record already exists');
    }

    await this.checkFks(data);

    let { endDate, expectedGraduationDate } = data;
    if (data.isCurrent) {
      endDate = undefined;
    } else {
      expectedGraduationDate = undefined;
    }

    const gpaNormalized = this.calculateNormalizedGpa(data.gpaRaw, data.gpaScale);

    const edu = await this.prisma.userEducations.create({
      data: {
        userId,
        educationLevelId: data.educationLevelId,
        institutionId: data.institutionId,
        majorId: data.majorId,
        minorMajorId: data.minorMajorId,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        expectedGraduationDate: expectedGraduationDate ? new Date(expectedGraduationDate) : null,
        isCurrent: data.isCurrent ?? false,
        gpaRaw: data.gpaRaw,
        gpaScale: data.gpaScale,
        gpaNormalized: gpaNormalized,
      }
    });

    await this.profileService.updateProfile(userId, {});
    return this.formatEducation(edu);
  }

  async findAll(userId: string, dto: PaginationDto) {
    const [educations, total] = await Promise.all([
      this.prisma.userEducations.findMany({
        where: { userId },
        skip: dto.skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
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
      throw new NotFoundException('Education not found');
    }
    return this.formatEducation(edu);
  }

  async update(userId: string, id: string, data: UpdateEducationDto) {
    const edu = await this.prisma.userEducations.findFirst({ where: { userId, id } });
    if (!edu) {
      throw new NotFoundException('Education not found');
    }

    if (data.minorMajorId || data.majorId) {
      const major = data.majorId ?? edu.majorId;
      const minor = data.minorMajorId ?? edu.minorMajorId;
      if (minor && major === minor) {
        throw new BadRequestException('minorMajorId cannot be the same as majorId');
      }
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
        }
      });
      if (existing) {
        throw new ConflictException('Education record already exists');
      }
    }

    const isCurrent = data.isCurrent !== undefined ? data.isCurrent : edu.isCurrent;
    let endDateRaw = data.endDate !== undefined ? data.endDate : (edu.endDate ? edu.endDate.toISOString() : undefined);
    let expectedGraduationDateRaw = data.expectedGraduationDate !== undefined ? data.expectedGraduationDate : (edu.expectedGraduationDate ? edu.expectedGraduationDate.toISOString() : undefined);
    
    if (isCurrent) {
      endDateRaw = undefined;
    } else {
      expectedGraduationDateRaw = undefined;
    }

    const gpaRaw = data.gpaRaw !== undefined ? data.gpaRaw : (edu.gpaRaw ? Number(edu.gpaRaw) : null);
    const gpaScale = data.gpaScale !== undefined ? data.gpaScale : edu.gpaScale;
    
    const gpaNormalized = this.calculateNormalizedGpa(gpaRaw, gpaScale);

    const updated = await this.prisma.userEducations.update({
      where: { id },
      data: {
        educationLevelId: data.educationLevelId,
        institutionId: data.institutionId,
        majorId: data.majorId,
        minorMajorId: data.minorMajorId === null ? null : data.minorMajorId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: endDateRaw ? new Date(endDateRaw) : null,
        expectedGraduationDate: expectedGraduationDateRaw ? new Date(expectedGraduationDateRaw) : null,
        isCurrent: data.isCurrent,
        gpaRaw: data.gpaRaw,
        gpaScale: data.gpaScale === null ? null : data.gpaScale,
        gpaNormalized: gpaNormalized,
      }
    });

    await this.profileService.updateProfile(userId, {});
    return this.formatEducation(updated);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.userEducations.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Education not found');
    }

    await this.prisma.userEducations.delete({
      where: { id },
    });

    await this.profileService.updateProfile(userId, {});
  }
}
"""

controller_content = """import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EducationsService } from '../services/educations.service';
import { CreateEducationDto } from '../dto/create-education.dto';
import { UpdateEducationDto } from '../dto/update-education.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EducationOwnershipGuard } from '../guards/education-ownership.guard';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('profile/educations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile/educations')
export class EducationsController {
  constructor(private readonly educationsService: EducationsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new education record' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(@Req() req: RequestWithUser, @Body() data: CreateEducationDto) {
    return this.educationsService.create(req.user.id, data);
  }

  @Get()
  @ApiOperation({ summary: 'Get all education records for the current user' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findAll(@Req() req: RequestWithUser, @Query() dto: PaginationDto) {
    return this.educationsService.findAll(req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(EducationOwnershipGuard)
  @ApiOperation({ summary: 'Get an education record by ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async findOne(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.educationsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @UseGuards(EducationOwnershipGuard)
  @ApiOperation({ summary: 'Update an education record' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateEducationDto,
  ) {
    return this.educationsService.update(req.user.id, id, data);
  }

  @Delete(':id')
  @UseGuards(EducationOwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an education record' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async remove(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.educationsService.remove(req.user.id, id);
  }
}
"""

with open('src/modules/profile/services/educations.service.ts', 'w') as f:
    f.write(service_content)

with open('src/modules/profile/controllers/educations.controller.ts', 'w') as f:
    f.write(controller_content)

