// [OMA-W002-T005] DraftTagsService Spec
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DraftTagsService } from './draft-tags.service';
import { DraftSpacesService } from '../spaces/draft-spaces.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DraftTagsService', () => {
  let service: DraftTagsService;
  let mockSpacesService: { findBySlug: jest.Mock };

  const mockPrisma = {
    draftTags: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    draftPages: {
      findFirst: jest.fn(),
    },
    draftPageTags: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockSpace = {
    id: 'space-1',
    ownerId: 'user-1',
    slug: 'my-space',
  };

  beforeEach(async () => {
    mockSpacesService = {
      findBySlug: jest.fn().mockResolvedValue(mockSpace),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftTagsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DraftSpacesService, useValue: mockSpacesService },
      ],
    }).compile();

    service = module.get<DraftTagsService>(DraftTagsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listTags', () => {
    // [OMA-W002-T005] Given valid workspace, When listTags is called, Then it returns tags in workspace ordered by name
    it('should return all tags within the workspace', async () => {
      // Arrange
      const userId = 'user-1';
      const spaceSlug = 'my-space';
      const tags = [
        {
          id: 'tag-1',
          spaceId: mockSpace.id,
          name: 'Academic',
          color: '#10b981',
        },
        {
          id: 'tag-2',
          spaceId: mockSpace.id,
          name: 'Urgent',
          color: '#ef4444',
        },
      ];

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftTags.findMany.mockResolvedValue(tags);

      // Act
      const result = await service.listTags(userId, spaceSlug);

      // Assert
      expect(mockSpacesService.findBySlug).toHaveBeenCalledWith(
        userId,
        spaceSlug,
      );
      expect(mockPrisma.draftTags.findMany).toHaveBeenCalledWith({
        where: { spaceId: mockSpace.id },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(tags);
    });
  });

  describe('createTag', () => {
    // [OMA-W002-T005] Given new tag name, When createTag is called, Then it creates tag
    it('should create new tag successfully', async () => {
      // Arrange
      const userId = 'user-1';
      const spaceSlug = 'my-space';
      const dto = { name: 'Scholarship', color: '#3b82f6' };

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftTags.findUnique.mockResolvedValue(null);
      mockPrisma.draftTags.create.mockResolvedValue({
        id: 'tag-new',
        spaceId: mockSpace.id,
        ...dto,
      });

      // Act
      const result = await service.createTag(userId, spaceSlug, dto);

      // Assert
      expect(mockPrisma.draftTags.create).toHaveBeenCalledWith({
        data: {
          spaceId: mockSpace.id,
          name: dto.name,
          color: dto.color,
        },
      });
      expect(result.name).toBe('Scholarship');
    });

    // [OMA-W002-T005] Given tag already exists in workspace, When createTag is called, Then it throws ConflictException
    it('should throw ConflictException if tag already exists in space', async () => {
      // Arrange
      const dto = { name: 'DuplicateTag' };
      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftTags.findUnique.mockResolvedValue({
        id: 'tag-1',
        name: 'DuplicateTag',
      });

      // Act & Assert
      await expect(
        service.createTag('user-1', 'my-space', dto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteTag', () => {
    // [OMA-W002-T005] Given tag exists in workspace, When deleteTag is called, Then it deletes tag
    it('should delete tag from workspace', async () => {
      // Arrange
      const userId = 'user-1';
      const tagId = 'tag-1';

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftTags.findFirst.mockResolvedValue({
        id: tagId,
        spaceId: mockSpace.id,
      });
      mockPrisma.draftTags.delete.mockResolvedValue({ id: tagId });

      // Act
      const result = await service.deleteTag(userId, 'my-space', tagId);

      // Assert
      expect(mockPrisma.draftTags.delete).toHaveBeenCalledWith({
        where: { id: tagId },
      });
      expect(result).toEqual({ deleted: true });
    });

    // [OMA-W002-T005] Given tag does not exist, When deleteTag is called, Then it throws NotFoundException
    it('should throw NotFoundException if tag does not exist in workspace', async () => {
      // Arrange
      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftTags.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.deleteTag('user-1', 'my-space', 'nonexistent-tag'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignTagToPage', () => {
    // [OMA-W002-T005] Given valid page and tag in workspace, When assignTagToPage is called, Then it upserts draftPageTags
    it('should assign tag to page via upsert', async () => {
      // Arrange
      const userId = 'user-1';
      const pageId = 'page-1';
      const tagId = 'tag-1';

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue({ id: pageId });
      mockPrisma.draftTags.findFirst.mockResolvedValue({ id: tagId });
      mockPrisma.draftPageTags.upsert.mockResolvedValue({ pageId, tagId });

      // Act
      const result = await service.assignTagToPage(
        userId,
        'my-space',
        pageId,
        tagId,
      );

      // Assert
      expect(mockPrisma.draftPageTags.upsert).toHaveBeenCalledWith({
        where: {
          pageId_tagId: { pageId, tagId },
        },
        create: { pageId, tagId },
        update: {},
      });
      expect(result).toEqual({ pageId, tagId });
    });

    // [OMA-W002-T005] Given page not found, When assignTagToPage is called, Then it throws NotFoundException
    it('should throw NotFoundException if target page is not found', async () => {
      // Arrange
      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(null);
      mockPrisma.draftTags.findFirst.mockResolvedValue({ id: 'tag-1' });

      // Act & Assert
      await expect(
        service.assignTagToPage('user-1', 'my-space', 'invalid-page', 'tag-1'),
      ).rejects.toThrow(NotFoundException);
    });

    // [OMA-W002-T005] Given tag not found, When assignTagToPage is called, Then it throws NotFoundException
    it('should throw NotFoundException if target tag is not found', async () => {
      // Arrange
      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue({ id: 'page-1' });
      mockPrisma.draftTags.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assignTagToPage('user-1', 'my-space', 'page-1', 'invalid-tag'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeTagFromPage', () => {
    // [OMA-W002-T005] Given valid page, When removeTagFromPage is called, Then it removes tag from page
    it('should remove tag assignment from page', async () => {
      // Arrange
      const userId = 'user-1';
      const pageId = 'page-1';
      const tagId = 'tag-1';

      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue({ id: pageId });
      mockPrisma.draftPageTags.deleteMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await service.removeTagFromPage(
        userId,
        'my-space',
        pageId,
        tagId,
      );

      // Assert
      expect(mockPrisma.draftPageTags.deleteMany).toHaveBeenCalledWith({
        where: { pageId, tagId },
      });
      expect(result).toEqual({ removed: true });
    });

    // [OMA-W002-T005] Given page not found, When removeTagFromPage is called, Then it throws NotFoundException
    it('should throw NotFoundException if page is not found on remove', async () => {
      // Arrange
      mockSpacesService.findBySlug.mockResolvedValue(mockSpace);
      mockPrisma.draftPages.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeTagFromPage(
          'user-1',
          'my-space',
          'invalid-page',
          'tag-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
