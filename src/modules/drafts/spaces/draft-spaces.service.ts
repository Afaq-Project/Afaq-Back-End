// [OMA-W002-T004] DraftSpacesService
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import slugify from 'slugify';

@Injectable()
export class DraftSpacesService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateUniqueSlug(
    ownerId: string,
    baseName: string,
  ): Promise<string> {
    const baseSlug =
      slugify(baseName, { lower: true, strict: true }) || 'workspace';
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.draftSpaces.findUnique({
        where: {
          ownerId_slug: {
            ownerId,
            slug,
          },
        },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async findAll(ownerId: string) {
    return this.prisma.draftSpaces.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            pages: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  }

  async findBySlug(ownerId: string, slug: string) {
    const space = await this.prisma.draftSpaces.findUnique({
      where: {
        ownerId_slug: {
          ownerId,
          slug,
        },
      },
      include: {
        pages: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
        tags: true,
      },
    });

    if (!space) {
      throw new NotFoundException({
        code: 'SPACE_NOT_FOUND',
        message: `Workspace with slug '${slug}' not found`,
      });
    }

    return space;
  }

  async create(ownerId: string, dto: CreateSpaceDto) {
    const slug = await this.generateUniqueSlug(ownerId, dto.name);

    return this.prisma.draftSpaces.create({
      data: {
        ownerId,
        slug,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
      },
    });
  }

  async update(ownerId: string, slug: string, dto: UpdateSpaceDto) {
    const space = await this.findBySlug(ownerId, slug);

    return this.prisma.draftSpaces.update({
      where: { id: space.id },
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
      },
    });
  }

  async delete(ownerId: string, slug: string) {
    const space = await this.findBySlug(ownerId, slug);

    await this.prisma.draftSpaces.delete({
      where: { id: space.id },
    });

    return { deleted: true };
  }
}
