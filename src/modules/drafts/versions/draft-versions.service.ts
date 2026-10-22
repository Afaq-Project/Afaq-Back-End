// [OMA-W002-T007] DraftVersionsService
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DraftPageStatus, Prisma, DraftPageVersions } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DraftVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listVersions(userId: string, pageId: string) {
    const page = await this.prisma.draftPages.findFirst({
      where: { id: pageId, userId, deletedAt: null },
    });

    if (!page) {
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Draft page not found',
      });
    }

    return this.prisma.draftPageVersions.findMany({
      where: { pageId, userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        pageId: true,
        userId: true,
        isFinalizedSnapshot: true,
        finalizedDocumentId: true,
        createdAt: true,
        contentJson: true,
      },
    });
  }

  async revertToVersion(userId: string, pageId: string, versionId: string) {
    const page = await this.prisma.draftPages.findFirst({
      where: { id: pageId, userId, deletedAt: null },
    });

    if (!page) {
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Draft page not found',
      });
    }

    if (page.status === DraftPageStatus.FINALIZED) {
      throw new ForbiddenException({
        code: 'PAGE_FINALIZED_LOCKED',
        message:
          'Draft is locked in FINALIZED state; unlock required before reverting',
      });
    }

    const version = await this.prisma.draftPageVersions.findFirst({
      where: { id: versionId, pageId, userId },
    });

    if (!version) {
      throw new NotFoundException({
        code: 'VERSION_NOT_FOUND',
        message: 'Historical version snapshot not found',
      });
    }

    const updatedPage = await this.prisma.draftPages.update({
      where: { id: pageId },
      data: {
        contentJson: version.contentJson as Prisma.InputJsonValue,
        status: DraftPageStatus.IN_PROGRESS,
      },
    });

    // Record snapshot of the revert action
    await this.prisma.draftPageVersions.create({
      data: {
        pageId,
        userId,
        contentJson: version.contentJson as Prisma.InputJsonValue,
      },
    });

    return updatedPage;
  }

  // [OMA-W006-T005] Proposal review lifecycle: snapshot creation
  async createSnapshot(
    userId: string,
    pageId: string,
    _customTitle?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<DraftPageVersions> {
    const client = tx || this.prisma;
    const page = await client.draftPages.findFirst({
      where: { id: pageId, userId, deletedAt: null },
    });

    if (!page) {
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Draft page not found',
      });
    }

    return client.draftPageVersions.create({
      data: {
        pageId,
        userId,
        contentJson: page.contentJson ?? {},
        isFinalizedSnapshot: false,
      },
    });
  }
}
