// [OMA-W002-T004] DraftPagesService
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DraftSpacesService } from '../spaces/draft-spaces.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { DraftPageStatus, Prisma } from '@prisma/client';
import slugify from 'slugify';

@Injectable()
export class DraftPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spacesService: DraftSpacesService,
  ) {}

  private async generateUniqueSlug(
    spaceId: string,
    baseTitle: string,
  ): Promise<string> {
    const baseSlug =
      slugify(baseTitle, { lower: true, strict: true }) || 'untitled';
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.draftPages.findFirst({
        where: {
          spaceId,
          slug,
          deletedAt: null,
        },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async findBySpaceAndId(userId: string, spaceSlug: string, pageId: string) {
    const space = await this.spacesService.findBySlug(userId, spaceSlug);

    const page = await this.prisma.draftPages.findFirst({
      where: {
        id: pageId,
        spaceId: space.id,
        userId,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
        attachments: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!page) {
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Draft page not found in this workspace',
      });
    }

    return page;
  }

  async create(userId: string, spaceSlug: string, dto: CreatePageDto) {
    const space = await this.spacesService.findBySlug(userId, spaceSlug);

    if (dto.parentId) {
      const parentPage = await this.prisma.draftPages.findFirst({
        where: {
          id: dto.parentId,
          spaceId: space.id,
          userId,
          deletedAt: null,
        },
      });

      if (!parentPage) {
        throw new BadRequestException({
          code: 'INVALID_PARENT_PAGE',
          message: 'Parent page must belong to the same user and workspace',
        });
      }
    }

    if (dto.documentId) {
      const doc = await this.prisma.documents.findFirst({
        where: { id: dto.documentId, userId },
      });
      if (!doc) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT',
          message: 'Referenced document not found or does not belong to user',
        });
      }
    }

    const lastSibling = await this.prisma.draftPages.findFirst({
      where: {
        spaceId: space.id,
        parentId: dto.parentId ?? null,
        deletedAt: null,
      },
      orderBy: { position: 'desc' },
    });

    const position = lastSibling ? lastSibling.position + 1 : 0;
    const slug = await this.generateUniqueSlug(space.id, dto.title);

    const page = await this.prisma.draftPages.create({
      data: {
        spaceId: space.id,
        userId,
        parentId: dto.parentId,
        documentId: dto.documentId,
        title: dto.title,
        slug,
        contentJson: (dto.contentJson ?? {
          type: 'doc',
          content: [],
        }) as Prisma.InputJsonValue,
        position,
        status: DraftPageStatus.DRAFT,
      },
    });

    // Initial version snapshot
    if (dto.contentJson) {
      await this.prisma.draftPageVersions.create({
        data: {
          pageId: page.id,
          userId,
          contentJson: dto.contentJson as Prisma.InputJsonValue,
        },
      });
    }

    return page;
  }

  async update(
    userId: string,
    spaceSlug: string,
    pageId: string,
    dto: UpdatePageDto,
  ) {
    const page = await this.findBySpaceAndId(userId, spaceSlug, pageId);

    // [OMA-W002-T005] Throw ConflictException (409) for finalized locked pages per OpenAPI spec
    if (page.status === DraftPageStatus.FINALIZED) {
      throw new ConflictException({
        code: 'PAGE_FINALIZED_LOCKED',
        message: 'Draft is locked in FINALIZED state; unlock required to edit',
      });
    }

    if (dto.parentId && dto.parentId !== page.parentId) {
      if (dto.parentId === page.id) {
        throw new BadRequestException('A page cannot be its own parent');
      }

      const parentPage = await this.prisma.draftPages.findFirst({
        where: {
          id: dto.parentId,
          spaceId: page.spaceId,
          userId,
          deletedAt: null,
        },
      });

      if (!parentPage) {
        throw new BadRequestException(
          'Parent page must belong to the same workspace',
        );
      }
    }

    const updateData: Prisma.DraftPagesUpdateInput = {};
    if (dto.title !== undefined) {
      updateData.title = dto.title;
      updateData.slug = await this.generateUniqueSlug(page.spaceId, dto.title);
    }
    if (dto.position !== undefined) {
      updateData.position = dto.position;
    }
    if (dto.parentId !== undefined) {
      updateData.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
        : { disconnect: true };
    }
    if (dto.contentJson !== undefined) {
      updateData.contentJson = dto.contentJson as Prisma.InputJsonValue;
      if (page.status === DraftPageStatus.DRAFT) {
        updateData.status = DraftPageStatus.IN_PROGRESS;
      }
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    const updatedPage = await this.prisma.draftPages.update({
      where: { id: page.id },
      data: updateData,
    });

    // Milestone snapshot on content update
    if (dto.contentJson) {
      const recentVersion = await this.prisma.draftPageVersions.findFirst({
        where: { pageId: page.id },
        orderBy: { createdAt: 'desc' },
      });

      const shouldSnapshot =
        !recentVersion ||
        Date.now() - recentVersion.createdAt.getTime() > 60 * 1000; // at most 1 snapshot per minute during auto-save

      if (shouldSnapshot) {
        await this.prisma.draftPageVersions.create({
          data: {
            pageId: page.id,
            userId,
            contentJson: dto.contentJson as Prisma.InputJsonValue,
          },
        });
      }
    }

    return updatedPage;
  }

  async softDelete(userId: string, spaceSlug: string, pageId: string) {
    const page = await this.findBySpaceAndId(userId, spaceSlug, pageId);

    await this.prisma.draftPages.update({
      where: { id: page.id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return { deleted: true };
  }
}
