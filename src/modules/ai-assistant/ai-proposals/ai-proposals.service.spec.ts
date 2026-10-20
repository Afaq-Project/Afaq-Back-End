// [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AiEditProposalStatus, DraftPageStatus } from '@prisma/client';
import {
  AiProposalsService,
  replaceProseMirrorText,
} from './ai-proposals.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DraftVersionsService } from '../../drafts/versions/draft-versions.service';

describe('AiProposalsService', () => {
  let service: AiProposalsService;
  let mockDraftVersionsService: {
    createSnapshot: jest.Mock;
  };

  const mockTx = {
    aiEditProposals: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    draftPages: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockPrisma = {
    $transaction: jest.fn(async (cb) => await cb(mockTx)),
    draftPages: {
      findFirst: jest.fn(),
    },
    aiEditProposals: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    mockDraftVersionsService = {
      createSnapshot: jest.fn().mockResolvedValue({ id: 'ver-snapshot-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProposalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DraftVersionsService, useValue: mockDraftVersionsService },
      ],
    }).compile();

    service = module.get<AiProposalsService>(AiProposalsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
  describe('replaceProseMirrorText AST helper', () => {
    it('should recursively find and replace text in TipTap ProseMirror document without corrupting structure', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Personal Statement' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'I want to study machine learning because it is great.',
              },
              { type: 'text', text: ' In conclusion, I hope to be admitted.' },
            ],
          },
        ],
      };

      const { updated, replacedCount } = replaceProseMirrorText(
        doc,
        'machine learning because it is great',
        'computational intelligence and neural representations',
      );

      expect(replacedCount).toBe(1);
      const updatedDoc = updated as typeof doc;
      expect(updatedDoc.content[1].content[0].text).toBe(
        'I want to study computational intelligence and neural representations.',
      );
      expect(updatedDoc.content[0].content[0].text).toBe('Personal Statement');
    });

    it('should return replacedCount 0 when target text does not match any node', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello World' }],
          },
        ],
      };

      const { updated, replacedCount } = replaceProseMirrorText(
        doc,
        'Nonexistent phrase',
        'New',
      );
      expect(replacedCount).toBe(0);
      expect(updated).toEqual(doc);
    });
  });

  // [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
  describe('createProposal', () => {
    it('should persist a proposal with PENDING status when draft page exists and belongs to user', async () => {
      const userId = 'user-1';
      const pageId = 'page-1';
      mockPrisma.draftPages.findFirst.mockResolvedValue({ id: pageId, userId });
      mockPrisma.aiEditProposals.create.mockResolvedValue({
        id: 'prop-1',
        userId,
        pageId,
        status: AiEditProposalStatus.PENDING,
        originalText: 'Draft statement',
        suggestedText: 'Polished statement',
      });

      const result = await service.createProposal(
        userId,
        pageId,
        'conv-1',
        'Draft statement',
        'Polished statement',
        'Improves clarity',
      );

      expect(mockPrisma.draftPages.findFirst).toHaveBeenCalledWith({
        where: { id: pageId, userId, deletedAt: null },
      });
      expect(mockPrisma.aiEditProposals.create).toHaveBeenCalledWith({
        data: {
          userId,
          pageId,
          conversationId: 'conv-1',
          originalText: 'Draft statement',
          suggestedText: 'Polished statement',
          explanation: 'Improves clarity',
          status: AiEditProposalStatus.PENDING,
        },
      });
      expect(result.status).toBe(AiEditProposalStatus.PENDING);
    });

    it('should throw NotFoundException if page is not found or does not belong to user', async () => {
      mockPrisma.draftPages.findFirst.mockResolvedValue(null);

      await expect(
        service.createProposal('user-1', 'page-invalid', null, 'old', 'new'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
  describe('getProposalsForPage', () => {
    it('should return list of proposals ordered by creation date descending', async () => {
      const mockProposals = [
        { id: 'prop-2', createdAt: new Date('2026-10-18T12:00:00Z') },
        { id: 'prop-1', createdAt: new Date('2026-10-18T10:00:00Z') },
      ];
      mockPrisma.aiEditProposals.findMany.mockResolvedValue(mockProposals);

      const res = await service.getProposalsForPage('user-1', 'page-1');

      expect(mockPrisma.aiEditProposals.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', pageId: 'page-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(res).toEqual(mockProposals);
    });
  });

  // [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
  describe('acceptProposal', () => {
    const userId = 'user-1';
    const proposalId = 'prop-1';
    const pageId = 'page-1';

    it('should atomically accept proposal, create rollback snapshot, apply AST edit, and update status', async () => {
      mockTx.aiEditProposals.updateMany.mockResolvedValue({ count: 1 });
      mockTx.aiEditProposals.findUnique.mockResolvedValue({
        id: proposalId,
        pageId,
        userId,
        originalText: 'rough draft sentence',
        suggestedText: 'elegantly structured academic argument',
      });
      mockTx.draftPages.findFirst.mockResolvedValue({
        id: pageId,
        userId,
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'This is a rough draft sentence in the essay.',
                },
              ],
            },
          ],
        },
      });
      mockTx.draftPages.update.mockResolvedValue({ id: pageId });

      const result = await service.acceptProposal(userId, proposalId);

      // Verify atomic check
      expect(mockTx.aiEditProposals.updateMany).toHaveBeenCalledWith({
        where: {
          id: proposalId,
          userId,
          status: AiEditProposalStatus.PENDING,
        },
        data: {
          status: AiEditProposalStatus.ACCEPTED,
          appliedAt: expect.any(Date),
        },
      });

      // Verify snapshot created before editing
      expect(mockDraftVersionsService.createSnapshot).toHaveBeenCalledWith(
        userId,
        pageId,
        'Snapshot before AI proposal acceptance',
        mockTx,
      );

      // Verify AST text replacement applied to document page
      expect(mockTx.draftPages.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: {
          contentJson: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'This is a elegantly structured academic argument in the essay.',
                  },
                ],
              },
            ],
          },
          status: DraftPageStatus.IN_PROGRESS,
        },
      });

      expect(result).toEqual({
        proposalId,
        status: 'ACCEPTED',
        snapshotCreated: true,
        pageId,
      });
    });

    it('should throw ConflictException if proposal is not PENDING or already accepted/rejected', async () => {
      mockTx.aiEditProposals.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptProposal(userId, proposalId)).rejects.toThrow(
        ConflictException,
      );
      expect(mockDraftVersionsService.createSnapshot).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if originalText cannot be found in document text nodes', async () => {
      mockTx.aiEditProposals.updateMany.mockResolvedValue({ count: 1 });
      mockTx.aiEditProposals.findUnique.mockResolvedValue({
        id: proposalId,
        pageId,
        userId,
        originalText: 'text that does not exist in document',
        suggestedText: 'replacement',
      });
      mockTx.draftPages.findFirst.mockResolvedValue({
        id: pageId,
        userId,
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Completely different text' }],
            },
          ],
        },
      });

      await expect(service.acceptProposal(userId, proposalId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
  describe('rejectProposal', () => {
    it('should update proposal status to REJECTED if pending', async () => {
      mockPrisma.aiEditProposals.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.rejectProposal('user-1', 'prop-1');

      expect(mockPrisma.aiEditProposals.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'prop-1',
          userId: 'user-1',
          status: AiEditProposalStatus.PENDING,
        },
        data: {
          status: AiEditProposalStatus.REJECTED,
        },
      });
      expect(result).toEqual({
        proposalId: 'prop-1',
        status: 'REJECTED',
      });
    });

    it('should throw ConflictException if proposal is not pending or not found', async () => {
      mockPrisma.aiEditProposals.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.rejectProposal('user-1', 'prop-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
