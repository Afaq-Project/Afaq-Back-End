// [OMA-W002-T005] DraftTagsService
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DraftSpacesService } from '../spaces/draft-spaces.service';
import { CreateTagDto } from './dto/create-tag.dto';

@Injectable()
export class DraftTagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spacesService: DraftSpacesService,
  ) {}

  async listTags(userId: string, spaceSlug: string) {
    const space = await this.spacesService.findBySlug(userId, spaceSlug);

    return this.prisma.draftTags.findMany({
      where: { spaceId: space.id },
      orderBy: { name: 'asc' },
    });
  }

  async createTag(userId: string, spaceSlug: string, dto: CreateTagDto) {
    const space = await this.spacesService.findBySlug(userId, spaceSlug);

    const existing = await this.prisma.draftTags.findUnique({
      where: {
        spaceId_name: {
          spaceId: space.id,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Tag '${dto.name}' already exists in this workspace`,
      );
    }

    return this.prisma.draftTags.create({
      data: {
        spaceId: space.id,
        name: dto.name,
        color: dto.color,
      },
    });
  }

  async deleteTag(userId: string, spaceSlug: string, tagId: string) {
    const space = await this.spacesService.findBySlug(userId, spaceSlug);

    const tag = await this.prisma.draftTags.findFirst({
      where: { id: tagId, spaceId: space.id },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found in this workspace');
    }

    await this.prisma.draftTags.delete({
      where: { id: tagId },
    });

    return { deleted: true };
  }

  async assignTagToPage(
    userId: string,
    spaceSlug: string,
    pageId: string,
    tagId: string,
  ) {
    const space = await this.spacesService.findBySlug(userId, spaceSlug);

    const [page, tag] = await Promise.all([
      this.prisma.draftPages.findFirst({
        where: { id: pageId, spaceId: space.id, userId, deletedAt: null },
      }),
      this.prisma.draftTags.findFirst({
        where: { id: tagId, spaceId: space.id },
      }),
    ]);

    if (!page) {
      throw new NotFoundException('Page not found');
    }
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.prisma.draftPageTags.upsert({
      where: {
        pageId_tagId: { pageId, tagId },
      },
      create: { pageId, tagId },
      update: {},
    });
  }

  async removeTagFromPage(
    userId: string,
    spaceSlug: string,
    pageId: string,
    tagId: string,
  ) {
    const space = await this.spacesService.findBySlug(userId, spaceSlug);

    const page = await this.prisma.draftPages.findFirst({
      where: { id: pageId, spaceId: space.id, userId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.prisma.draftPageTags.deleteMany({
      where: { pageId, tagId },
    });

    return { removed: true };
  }
}
