// [OMA-W006-T005] Proposal review lifecycle and atomic AST mutation
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AiEditProposalStatus, DraftPageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DraftVersionsService } from '../../drafts/versions/draft-versions.service';

export interface ProseMirrorNode {
  type?: string;
  text?: string;
  content?: ProseMirrorNode[];
  [key: string]: unknown;
}

export function replaceProseMirrorText(
  node: unknown,
  originalText: string,
  suggestedText: string,
): { updated: unknown; replacedCount: number } {
  if (!node || typeof node !== 'object') {
    return { updated: node, replacedCount: 0 };
  }

  if (Array.isArray(node)) {
    let count = 0;
    const mapped = node.map((item: unknown) => {
      const res = replaceProseMirrorText(item, originalText, suggestedText);
      count += res.replacedCount;
      return res.updated;
    });
    return { updated: mapped, replacedCount: count };
  }

  const copy = { ...(node as Record<string, unknown>) };
  let count = 0;

  if (copy.type === 'text' && typeof copy.text === 'string') {
    if (copy.text.includes(originalText)) {
      // [OMA-W006-T007] Functional string replacer avoids JavaScript $ pattern substitution
      copy.text = copy.text.replace(originalText, () => suggestedText);
      count++;
    }
  }

  if (Array.isArray(copy.content)) {
    const res = replaceProseMirrorText(
      copy.content,
      originalText,
      suggestedText,
    );
    copy.content = res.updated;
    count += res.replacedCount;
  }

  return { updated: copy, replacedCount: count };
}

@Injectable()
export class AiProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly draftVersionsService: DraftVersionsService,
  ) {}

  async createProposal(
    userId: string,
    pageId: string,
    conversationId: string | null,
    originalText: string,
    suggestedText: string,
    explanation?: string,
  ) {
    const page = await this.prisma.draftPages.findFirst({
      where: { id: pageId, userId, deletedAt: null },
    });
    if (!page) {
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Draft page not found',
      });
    }

    return this.prisma.aiEditProposals.create({
      data: {
        userId,
        pageId,
        conversationId: conversationId || undefined,
        originalText,
        suggestedText,
        explanation,
        status: AiEditProposalStatus.PENDING,
      },
    });
  }

  async getProposalsForPage(userId: string, pageId: string) {
    return this.prisma.aiEditProposals.findMany({
      where: { userId, pageId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptProposal(userId: string, proposalId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updateRes = await tx.aiEditProposals.updateMany({
        where: {
          id: proposalId,
          userId,
          status: AiEditProposalStatus.PENDING,
        },
        data: {
          status: AiEditProposalStatus.ACCEPTED,
          appliedAt: new Date(),
        },
      });

      if (updateRes.count === 0) {
        throw new ConflictException(
          'Proposal is no longer pending or does not exist',
        );
      }

      const proposal = await tx.aiEditProposals.findUnique({
        where: { id: proposalId },
      });

      if (!proposal) {
        throw new NotFoundException('Proposal not found');
      }

      // Snapshot prior to mutation
      await this.draftVersionsService.createSnapshot(
        userId,
        proposal.pageId,
        'Snapshot before AI proposal acceptance',
        tx,
      );

      const page = await tx.draftPages.findFirst({
        where: { id: proposal.pageId, userId, deletedAt: null },
      });

      if (!page) {
        throw new NotFoundException('Draft page not found');
      }

      const { updated, replacedCount } = replaceProseMirrorText(
        page.contentJson,
        proposal.originalText,
        proposal.suggestedText,
      );

      if (replacedCount === 0) {
        throw new BadRequestException(
          'The original text could not be located in document text nodes',
        );
      }

      await tx.draftPages.update({
        where: { id: proposal.pageId },
        data: {
          contentJson: updated as Prisma.InputJsonValue,
          status: DraftPageStatus.IN_PROGRESS,
        },
      });

      return {
        proposalId,
        status: 'ACCEPTED',
        snapshotCreated: true,
        pageId: proposal.pageId,
      };
    });
  }

  async rejectProposal(userId: string, proposalId: string) {
    const updateRes = await this.prisma.aiEditProposals.updateMany({
      where: {
        id: proposalId,
        userId,
        status: AiEditProposalStatus.PENDING,
      },
      data: {
        status: AiEditProposalStatus.REJECTED,
      },
    });

    if (updateRes.count === 0) {
      throw new ConflictException(
        'Proposal is no longer pending or does not exist',
      );
    }

    return {
      proposalId,
      status: 'REJECTED',
    };
  }
}
