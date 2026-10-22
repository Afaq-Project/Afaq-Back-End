// [OMA-W002-T004] DraftPagesService Spec
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DraftPagesService } from './draft-pages.service';
import { DraftSpacesService } from '../spaces/draft-spaces.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DraftPageStatus } from '@prisma/client';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

describe('DraftPagesService', () => {
  let service: DraftPagesService;
  let mockSpacesService: { findBySlug: jest.Mock };

  const mockPrisma = {
    draftPages: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    draftPageVersions: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    documents: {
      findFirst: jest.fn(),
    },
  };

  const mockSpace = {
    id: 'space-1',
    ownerId: 'user-1',
    slug: 'my-workspace',
    name: 'My Workspace',
  };

  beforeEach(async () => {
    mockSpacesService = {
      findBySlug: jest.fn().mockResolvedValue(mockSpace),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftPagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DraftSpacesService, useValue: mockSpacesService },
      ],
    }).compile();

    service = module.get<DraftPagesService>(DraftPagesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findBySpaceAndId', () => {
    // [OMA-W002-T004] Given valid space and page ID belonging to user, When findBySpaceAndId is called, Then it returns the page
    it('should return page when found in workspace', async () => {
      // Arrange
      const userId = 'user-1';
      const spaceSlug = 'my-workspace';
      const pageId = 'page-1';
      const page = {
        id: pageId,
        spaceId: mockSpace.id,
        userId,
        title: 'Statement of Purpose',
        status: DraftPageStatus.DRAFT,
      };

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(page);

      // Act
      const result = await service.findBySpaceAndId(userId, spaceSlug, pageId);

      // Assert
      expect(mockSpacesService.findBySlug).toHaveBeenCalledWith(
        userId,
        spaceSlug,
      );
      expect(mockPrisma.draftPages.findFirst).toHaveBeenCalledWith({
        where: {
          id: pageId,
          spaceId: mockSpace.id,
          userId,
          deletedAt: null,
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(page);
    });

    // [OMA-W002-T004] Given a non-existent page or unauthorized user, When findBySpaceAndId is called, Then it throws NotFoundException
    it('should throw NotFoundException if page is not found or user is unauthorized (IDOR check)', async () => {
      // Arrange
      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findBySpaceAndId('user-1', 'my-workspace', 'nonexistent-page'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    // [OMA-W002-T004] Given valid input, When create is called, Then it generates slug, calculates position, and creates page with snapshot
    it('should create a new draft page and record initial version snapshot', async () => {
      // Arrange
      const userId = 'user-1';
      const spaceSlug = 'my-workspace';
      const dto: CreatePageDto = {
        title: 'Personal Statement',
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', text: 'Hello' }],
        },
      };

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst
        .mockResolvedValueOnce({ position: 2 }) // lastSibling position check
        .mockResolvedValueOnce(null); // slug uniqueness check

      const createdPage = {
        id: 'page-1',
        spaceId: mockSpace.id,
        userId,
        title: dto.title,
        slug: 'personal-statement',
        position: 3,
        status: DraftPageStatus.DRAFT,
        contentJson: dto.contentJson,
      };
      mockPrisma.draftPages.create.mockResolvedValue(createdPage);

      // Act
      const result = await service.create(userId, spaceSlug, dto);

      // Assert
      expect(mockPrisma.draftPages.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          spaceId: mockSpace.id,
          userId,
          title: dto.title,
          slug: 'personal-statement',
          position: 3,
          status: DraftPageStatus.DRAFT,
        }),
      });
      expect(mockPrisma.draftPageVersions.create).toHaveBeenCalledWith({
        data: {
          pageId: createdPage.id,
          userId,
          contentJson: dto.contentJson,
        },
      });
      expect(result).toEqual(createdPage);
    });

    // [OMA-W002-T004] Given an invalid parentId (not in space or different user), When create is called, Then it throws BadRequestException
    it('should throw BadRequestException if parent page does not belong to the workspace', async () => {
      // Arrange
      const dto: CreatePageDto = {
        title: 'Sub Page',
        parentId: 'foreign-parent-id',
      };
      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(null); // Parent not found

      // Act & Assert
      await expect(
        service.create('user-1', 'my-workspace', dto),
      ).rejects.toThrow(BadRequestException);
    });

    // [OMA-W002-T004] Given an invalid documentId (not found or different user), When create is called, Then it throws BadRequestException
    it('should throw BadRequestException if referenced document does not exist for user', async () => {
      // Arrange
      const dto: CreatePageDto = {
        title: 'Linked Page',
        documentId: 'invalid-doc-id',
      };
      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.documents.findFirst.mockResolvedValue(null); // Doc not found

      // Act & Assert
      await expect(
        service.create('user-1', 'my-workspace', dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    // [OMA-W002-T004] Given a page in FINALIZED state, When update is called, Then it throws ConflictException
    it('should throw ConflictException if page is locked in FINALIZED state', async () => {
      // Arrange
      const pageId = 'page-1';
      const finalizedPage = {
        id: pageId,
        spaceId: mockSpace.id,
        userId: 'user-1',
        status: DraftPageStatus.FINALIZED,
      };

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(finalizedPage);

      // Act & Assert
      await expect(
        service.update('user-1', 'my-workspace', pageId, {
          title: 'New Title',
        }),
      ).rejects.toThrow(ConflictException);
    });

    // [OMA-W002-T004] Given a page update where page attempts to be its own parent, When update is called, Then it throws BadRequestException
    it('should throw BadRequestException if page attempts to set itself as parent', async () => {
      // Arrange
      const pageId = 'page-1';
      const page = {
        id: pageId,
        spaceId: mockSpace.id,
        userId: 'user-1',
        status: DraftPageStatus.DRAFT,
        parentId: null,
      };

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(page);

      // Act & Assert
      await expect(
        service.update('user-1', 'my-workspace', pageId, { parentId: pageId }),
      ).rejects.toThrow(BadRequestException);
    });

    // [OMA-W002-T004] Given valid auto-save content update, When update is called, Then status transitions from DRAFT to IN_PROGRESS and version is created
    it('should auto-save content and transition status to IN_PROGRESS with version snapshot', async () => {
      // Arrange
      const pageId = 'page-1';
      const page = {
        id: pageId,
        spaceId: mockSpace.id,
        userId: 'user-1',
        status: DraftPageStatus.DRAFT,
        title: 'Original Title',
      };
      const dto: UpdatePageDto = {
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', text: 'Updated content' }],
        },
      };

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(page);
      mockPrisma.draftPageVersions.findFirst.mockResolvedValue(null); // No previous version
      mockPrisma.draftPages.update.mockResolvedValue({
        ...page,
        contentJson: dto.contentJson,
        status: DraftPageStatus.IN_PROGRESS,
      });

      // Act
      const result = await service.update(
        'user-1',
        'my-workspace',
        pageId,
        dto,
      );

      // Assert
      expect(mockPrisma.draftPages.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: expect.objectContaining({
          contentJson: dto.contentJson,
          status: DraftPageStatus.IN_PROGRESS,
        }),
      });
      expect(mockPrisma.draftPageVersions.create).toHaveBeenCalledWith({
        data: {
          pageId,
          userId: 'user-1',
          contentJson: dto.contentJson,
        },
      });
      expect(result.status).toBe(DraftPageStatus.IN_PROGRESS);
    });

    // [OMA-W002-T004] Given title update, When update is called, Then unique slug is regenerated
    it('should regenerate slug when title is updated', async () => {
      // Arrange
      const pageId = 'page-1';
      const page = {
        id: pageId,
        spaceId: mockSpace.id,
        userId: 'user-1',
        status: DraftPageStatus.IN_PROGRESS,
        title: 'Old Title',
      };
      const dto: UpdatePageDto = { title: 'Renamed Title' };

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      // First findFirst is for finding the page
      mockPrisma.draftPages.findFirst
        .mockResolvedValueOnce(page)
        .mockResolvedValueOnce(null); // Slug uniqueness check
      mockPrisma.draftPages.update.mockResolvedValue({
        ...page,
        title: dto.title,
        slug: 'renamed-title',
      });

      // Act
      const result = await service.update(
        'user-1',
        'my-workspace',
        pageId,
        dto,
      );

      // Assert
      expect(mockPrisma.draftPages.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: expect.objectContaining({
          title: 'Renamed Title',
          slug: 'renamed-title',
        }),
      });
      expect(result.title).toBe('Renamed Title');
    });

    // [OMA-W003-T002] Verify DraftPageStatus lifecycle enum updates
    it('should update page status when explicit status is provided in update dto', async () => {
      // Arrange
      const pageId = 'page-1';
      const page = {
        id: pageId,
        spaceId: mockSpace.id,
        userId: 'user-1',
        status: DraftPageStatus.IN_PROGRESS,
        title: 'Title',
      };
      const dto: UpdatePageDto = {
        status: DraftPageStatus.ARCHIVED,
      };

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(page);
      mockPrisma.draftPages.update.mockResolvedValue({
        ...page,
        status: DraftPageStatus.ARCHIVED,
      });

      // Act
      const result = await service.update(
        'user-1',
        'my-workspace',
        pageId,
        dto,
      );

      // Assert
      expect(mockPrisma.draftPages.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: expect.objectContaining({
          status: DraftPageStatus.ARCHIVED,
        }),
      });
      expect(result.status).toBe(DraftPageStatus.ARCHIVED);
    });
  });

  describe('softDelete', () => {
    // [OMA-W002-T004] Given valid page and workspace, When softDelete is called, Then it sets deletedAt and deletedBy
    it('should soft-delete draft page and record deletedBy', async () => {
      // Arrange
      const pageId = 'page-1';
      const page = { id: pageId, spaceId: mockSpace.id, userId: 'user-1' };

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(page);
      mockPrisma.draftPages.update.mockResolvedValue({
        ...page,
        deletedAt: new Date(),
      });

      // Act
      const result = await service.softDelete('user-1', 'my-workspace', pageId);

      // Assert
      expect(mockPrisma.draftPages.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: {
          deletedAt: expect.any(Date),
          deletedBy: 'user-1',
        },
      });
      expect(result).toEqual({ deleted: true });
    });
  });
});
