// [OMA-W002-T005] DraftTemplatesService
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class DraftTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, category?: string) {
    const where: Prisma.DraftTemplatesWhereInput = {
      OR: [{ isDefault: true }, { creatorId: userId }],
    };

    if (category) {
      where.category = category;
    }

    return this.prisma.draftTemplates.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // [OMA-W002-T005] Prevent IDOR: allow access only to defaults or owned templates
  async findById(id: string, userId?: string) {
    const template = await this.prisma.draftTemplates.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Template not found',
      });
    }

    const isOwner =
      userId &&
      (template.creatorId === userId ||
        (template as unknown as { createdById?: string }).createdById ===
          userId);

    if (!template.isDefault && !isOwner) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Template not found',
      });
    }

    return template;
  }

  // [OMA-W002-T005] Enforce role check for default templates and verify workspace ownership
  async create(userId: string, dto: CreateTemplateDto, userRole?: string) {
    const isAdmin = userRole === 'admin' || userRole === 'system_admin';
    const isDefault = isAdmin ? (dto.isDefault ?? false) : false;

    if (dto.spaceId && this.prisma.draftSpaces?.findFirst) {
      const space = await this.prisma.draftSpaces.findFirst({
        where: { id: dto.spaceId, ownerId: userId },
      });
      if (!space) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_WORKSPACE',
          message: 'Workspace does not exist or you do not own it',
        });
      }
    }

    return this.prisma.draftTemplates.create({
      data: {
        title: dto.title,
        description: dto.description,
        contentJson: dto.contentJson as Prisma.InputJsonValue,
        category: dto.category ?? 'General',
        icon: dto.icon,
        isDefault,
        spaceId: dto.spaceId,
        creatorId: userId,
      },
    });
  }

  async delete(userId: string, id: string) {
    const template = await this.findById(id, userId);

    if (template.creatorId !== userId) {
      throw new ForbiddenException(
        'Cannot delete a template you did not create',
      );
    }

    await this.prisma.draftTemplates.delete({
      where: { id },
    });

    return { deleted: true };
  }
}
