// [OMA-W002-T007] DraftVersionsService Spec
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DraftVersionsService } from './draft-versions.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DraftPageStatus } from '@prisma/client';

describe('DraftVersionsService', () => {
  let service: DraftVersionsService;

  const mockPrisma = {
    draftPages: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    draftPageVersions: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftVersionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DraftVersionsService>(DraftVersionsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listVersions', () => {
    // [OMA-W002-T007] Given page exists and belongs to user, When listVersions is called, Then it returns historical versions descending
    it('should return chronological version snapshots for page', async () => {
      // Arrange
      const userId = 'user-1';
      const pageId = 'page-1';
      const page = { id: pageId, userId, status: DraftPageStatus.IN_PROGRESS };
      const versions = [
        {
          id: 'v-2',
          pageId,
          userId,
          isFinalizedSnapshot: false,
          finalizedDocumentId: null,
          createdAt: new Date('2026-10-17T12:00:00Z'),
          contentJson: { type: 'doc' },
        },
        {
          id: 'v-1',
          pageId,
          userId,
          isFinalizedSnapshot: false,
          finalizedDocumentId: null,
          createdAt: new Date('2026-10-17T11:00:00Z'),
          contentJson: { type: 'doc' },
        },
      ];

      mockPrisma.draftPages.findFirst.mockResolvedValue(page);
      mockPrisma.draftPageVersions.findMany.mockResolvedValue(versions);

      // Act
      const result = await service.listVersions(userId, pageId);

      // Assert
      expect(mockPrisma.draftPages.findFirst).toHaveBeenCalledWith({
        where: { id: pageId, userId, deletedAt: null },
      });
      expect(mockPrisma.draftPageVersions.findMany).toHaveBeenCalledWith({
        where: { pageId, userId },
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({
          id: true,
          pageId: true,
          userId: true,
          contentJson: true,
        }),
      });
      expect(result).toEqual(versions);
    });

    // [OMA-W002-T007] Given page does not exist or belongs to another user, When listVersions is called, Then it throws NotFoundException (IDOR protection)
    it('should throw NotFoundException if page is not found or not owned by user', async () => {
      // Arrange
      mockPrisma.draftPages.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.listVersions('user-1', 'foreign-page'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revertToVersion', () => {
    // [OMA-W002-T007] Given valid page and version, When revertToVersion is called, Then it restores content and creates snapshot
    it('should restore page content to version snapshot and create a revert milestone', async () => {
      // Arrange
      const userId = 'user-1';
      const pageId = 'page-1';
      const versionId = 'v-1';
      const page = { id: pageId, userId, status: DraftPageStatus.IN_PROGRESS };
      const historicalVersion = {
        id: versionId,
        pageId,
        userId,
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', text: 'Restored text' }],
        },
      };
      const updatedPage = {
        ...page,
        contentJson: historicalVersion.contentJson,
        status: DraftPageStatus.IN_PROGRESS,
      };

      mockPrisma.draftPages.findFirst.mockResolvedValue(page);
      mockPrisma.draftPageVersions.findFirst.mockResolvedValue(
        historicalVersion,
      );
      mockPrisma.draftPages.update.mockResolvedValue(updatedPage);
      mockPrisma.draftPageVersions.create.mockResolvedValue({ id: 'v-new' });

      // Act
      const result = await service.revertToVersion(userId, pageId, versionId);

      // Assert
      expect(mockPrisma.draftPages.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: {
          contentJson: historicalVersion.contentJson,
          status: DraftPageStatus.IN_PROGRESS,
        },
      });
      expect(mockPrisma.draftPageVersions.create).toHaveBeenCalledWith({
        data: {
          pageId,
          userId,
          contentJson: historicalVersion.contentJson,
        },
      });
      expect(result).toEqual(updatedPage);
    });

    // [OMA-W002-T007] Given page is FINALIZED, When revertToVersion is called, Then it throws ForbiddenException
    it('should throw ForbiddenException if page is locked in FINALIZED status', async () => {
      // Arrange
      const userId = 'user-1';
      const pageId = 'page-1';
      const page = { id: pageId, userId, status: DraftPageStatus.FINALIZED };

      mockPrisma.draftPages.findFirst.mockResolvedValue(page);

      // Act & Assert
      await expect(
        service.revertToVersion(userId, pageId, 'v-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.draftPages.update).not.toHaveBeenCalled();
    });

    // [OMA-W002-T007] Given page not found or unauthorized, When revertToVersion is called, Then it throws NotFoundException
    it('should throw NotFoundException if page is not found for user', async () => {
      // Arrange
      mockPrisma.draftPages.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.revertToVersion('user-1', 'invalid-page', 'v-1'),
      ).rejects.toThrow(NotFoundException);
    });

    // [OMA-W002-T007] Given historical version not found or belongs to another page/user, When revertToVersion is called, Then it throws NotFoundException
    it('should throw NotFoundException if version snapshot is not found', async () => {
      // Arrange
      const userId = 'user-1';
      const pageId = 'page-1';
      const page = { id: pageId, userId, status: DraftPageStatus.IN_PROGRESS };

      mockPrisma.draftPages.findFirst.mockResolvedValue(page);
      mockPrisma.draftPageVersions.findFirst.mockResolvedValue(null); // Version not found

      // Act & Assert
      await expect(
        service.revertToVersion(userId, pageId, 'nonexistent-version'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.draftPages.update).not.toHaveBeenCalled();
    });
  });
});
