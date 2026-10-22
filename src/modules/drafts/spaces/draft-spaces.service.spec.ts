// [OMA-W002-T004] DraftSpacesService Spec
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DraftSpacesService } from './draft-spaces.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';

describe('DraftSpacesService', () => {
  let service: DraftSpacesService;

  const mockPrisma = {
    draftSpaces: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftSpacesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DraftSpacesService>(DraftSpacesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    // [OMA-W002-T004] Given an ownerId, When findAll is called, Then it returns only spaces owned by that user with page counts
    it('should return all draft spaces for owner with page counts', async () => {
      // Arrange
      const ownerId = 'user-1';
      const spaces = [
        {
          id: 'space-1',
          ownerId,
          slug: 'chevening-2026',
          name: 'Chevening 2026',
          _count: { pages: 3 },
        },
      ];
      mockPrisma.draftSpaces.findMany.mockResolvedValue(spaces);

      // Act
      const result = await service.findAll(ownerId);

      // Assert
      expect(mockPrisma.draftSpaces.findMany).toHaveBeenCalledWith({
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
      expect(result).toEqual(spaces);
    });
  });

  describe('findBySlug', () => {
    // [OMA-W002-T004] Given an ownerId and existing slug, When findBySlug is called, Then it returns the workspace
    it('should return space when found for the given owner and slug', async () => {
      // Arrange
      const ownerId = 'user-1';
      const slug = 'chevening-2026';
      const space = {
        id: 'space-1',
        ownerId,
        slug,
        name: 'Chevening 2026',
        pages: [],
        tags: [],
      };
      mockPrisma.draftSpaces.findUnique.mockResolvedValue(space);

      // Act
      const result = await service.findBySlug(ownerId, slug);

      // Assert
      expect(mockPrisma.draftSpaces.findUnique).toHaveBeenCalledWith({
        where: { ownerId_slug: { ownerId, slug } },
        include: expect.objectContaining({
          pages: expect.any(Object),
          tags: true,
        }),
      });
      expect(result).toEqual(space);
    });

    // [OMA-W002-T004] Given a non-existent slug or slug owned by another user (IDOR prevention), When findBySlug is called, Then it throws NotFoundException
    it('should throw NotFoundException if workspace does not exist or belongs to another user (IDOR check)', async () => {
      // Arrange
      const ownerId = 'user-1';
      const foreignSlug = 'secret-foreign-space';
      mockPrisma.draftSpaces.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findBySlug(ownerId, foreignSlug)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    // [OMA-W002-T004] Given unique name, When create is called, Then it generates base slug and persists space
    it('should generate base slug and create space successfully', async () => {
      // Arrange
      const ownerId = 'user-1';
      const dto: CreateSpaceDto = {
        name: 'Fulbright 2026',
        description: 'Applications and statements',
        icon: 'graduation-cap',
      };
      mockPrisma.draftSpaces.findUnique.mockResolvedValue(null);
      mockPrisma.draftSpaces.create.mockResolvedValue({
        id: 'space-2',
        ownerId,
        slug: 'fulbright-2026',
        ...dto,
      });

      // Act
      const result = await service.create(ownerId, dto);

      // Assert
      expect(mockPrisma.draftSpaces.create).toHaveBeenCalledWith({
        data: {
          ownerId,
          slug: 'fulbright-2026',
          name: dto.name,
          description: dto.description,
          icon: dto.icon,
        },
      });
      expect(result.slug).toBe('fulbright-2026');
    });

    // [OMA-W002-T004] Given name collision, When create is called, Then it resolves slug collision by appending incrementing index
    it('should resolve slug collision by appending counter suffix', async () => {
      // Arrange
      const ownerId = 'user-1';
      const dto: CreateSpaceDto = { name: 'Chevening' };

      // First call (chevening) exists, second call (chevening-1) does not
      mockPrisma.draftSpaces.findUnique
        .mockResolvedValueOnce({ id: 'existing-1', slug: 'chevening' })
        .mockResolvedValueOnce(null);

      mockPrisma.draftSpaces.create.mockResolvedValue({
        id: 'space-3',
        ownerId,
        slug: 'chevening-1',
        name: dto.name,
      });

      // Act
      const result = await service.create(ownerId, dto);

      // Assert
      expect(mockPrisma.draftSpaces.create).toHaveBeenCalledWith({
        data: {
          ownerId,
          slug: 'chevening-1',
          name: dto.name,
          description: undefined,
          icon: undefined,
        },
      });
      expect(result.slug).toBe('chevening-1');
    });
  });

  describe('update', () => {
    // [OMA-W002-T004] Given valid ownership and update dto, When update is called, Then it updates space details
    it('should update space details', async () => {
      // Arrange
      const ownerId = 'user-1';
      const slug = 'chevening-2026';
      const existing = { id: 'space-1', ownerId, slug, name: 'Old Name' };
      const dto: UpdateSpaceDto = {
        name: 'New Name',
        description: 'Updated desc',
      };

      mockPrisma.draftSpaces.findUnique.mockResolvedValue(existing);
      mockPrisma.draftSpaces.update.mockResolvedValue({ ...existing, ...dto });

      // Act
      const result = await service.update(ownerId, slug, dto);

      // Assert
      expect(mockPrisma.draftSpaces.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: {
          name: dto.name,
          description: dto.description,
          icon: undefined,
        },
      });
      expect(result.name).toBe('New Name');
    });

    // [OMA-W002-T004] Given foreign space, When update is called, Then it rejects with NotFoundException (IDOR check)
    it('should throw NotFoundException on update if space is not owned by user', async () => {
      // Arrange
      const ownerId = 'user-1';
      mockPrisma.draftSpaces.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(ownerId, 'foreign-space', { name: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    // [OMA-W002-T004] Given owned space, When delete is called, Then it deletes the space and returns confirmation
    it('should delete draft space successfully', async () => {
      // Arrange
      const ownerId = 'user-1';
      const slug = 'chevening-2026';
      const existing = { id: 'space-1', ownerId, slug };

      mockPrisma.draftSpaces.findUnique.mockResolvedValue(existing);
      mockPrisma.draftSpaces.delete.mockResolvedValue(existing);

      // Act
      const result = await service.delete(ownerId, slug);

      // Assert
      expect(mockPrisma.draftSpaces.delete).toHaveBeenCalledWith({
        where: { id: existing.id },
      });
      expect(result).toEqual({ deleted: true });
    });

    // [OMA-W002-T004] Given foreign space, When delete is called, Then it rejects with NotFoundException (IDOR check)
    it('should throw NotFoundException on delete if space does not belong to user', async () => {
      // Arrange
      mockPrisma.draftSpaces.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.delete('user-1', 'unauthorized-space'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
