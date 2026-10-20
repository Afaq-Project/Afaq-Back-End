// [OMA-W002-T005] DraftTemplatesService Spec
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DraftTemplatesService } from './draft-templates.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DraftTemplatesService', () => {
  let service: DraftTemplatesService;

  const mockPrisma = {
    draftTemplates: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    draftSpaces: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftTemplatesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DraftTemplatesService>(DraftTemplatesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    // [OMA-W002-T005] Given a user and category filter, When findAll is called, Then it returns global defaults and user templates
    it('should return default and user-created templates', async () => {
      // Arrange
      const userId = 'user-1';
      const templates = [
        {
          id: 'tmpl-1',
          title: 'Chevening SOP',
          isDefault: true,
          category: 'Scholarship',
        },
        {
          id: 'tmpl-2',
          title: 'My Custom Template',
          isDefault: false,
          creatorId: userId,
          category: 'Scholarship',
        },
      ];
      mockPrisma.draftTemplates.findMany.mockResolvedValue(templates);

      // Act
      const result = await service.findAll(userId, 'Scholarship');

      // Assert
      expect(mockPrisma.draftTemplates.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ isDefault: true }, { creatorId: userId }],
          category: 'Scholarship',
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result).toEqual(templates);
    });
  });

  describe('findById', () => {
    // [OMA-W002-T005] Given existing default template id, When findById is called, Then it returns the template
    it('should return default template by id', async () => {
      // Arrange
      const template = { id: 'tmpl-1', title: 'Standard CV', isDefault: true };
      mockPrisma.draftTemplates.findUnique.mockResolvedValue(template);

      // Act
      const result = await service.findById('tmpl-1');

      // Assert
      expect(mockPrisma.draftTemplates.findUnique).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
      });
      expect(result).toEqual(template);
    });

    // [OMA-W002-T005] Given user owned template, When findById is called by owner, Then it returns the template
    it('should return private template if caller is creator', async () => {
      // Arrange
      const userId = 'user-1';
      const template = {
        id: 'tmpl-2',
        title: 'Custom Template',
        isDefault: false,
        creatorId: userId,
      };
      mockPrisma.draftTemplates.findUnique.mockResolvedValue(template);

      // Act
      const result = await service.findById('tmpl-2', userId);

      // Assert
      expect(result).toEqual(template);
    });

    // [OMA-W002-T005] Given private template, When findById is called by other user (IDOR prevention), Then it throws NotFoundException
    it('should throw NotFoundException if template is private and caller is not creator', async () => {
      // Arrange
      const template = {
        id: 'tmpl-3',
        title: 'User A Secret Template',
        isDefault: false,
        creatorId: 'user-a',
      };
      mockPrisma.draftTemplates.findUnique.mockResolvedValue(template);

      // Act & Assert
      await expect(service.findById('tmpl-3', 'user-b')).rejects.toThrow(
        NotFoundException,
      );
    });

    // [OMA-W002-T005] Given non-existent template, When findById is called, Then it throws NotFoundException
    it('should throw NotFoundException if template does not exist', async () => {
      // Arrange
      mockPrisma.draftTemplates.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    // [OMA-W002-T005] Given valid template payload, When create is called, Then it creates template with creatorId
    it('should create template successfully', async () => {
      // Arrange
      const userId = 'user-1';
      const dto = {
        title: 'Research Proposal Template',
        description: 'Standard format for PhD research proposals',
        contentJson: { type: 'doc', content: [] },
        category: 'Research',
        icon: 'book',
      };
      const created = {
        id: 'tmpl-new',
        creatorId: userId,
        ...dto,
        isDefault: false,
      };
      mockPrisma.draftTemplates.create.mockResolvedValue(created);

      // Act
      const result = await service.create(userId, dto);

      // Assert
      expect(mockPrisma.draftTemplates.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          description: dto.description,
          contentJson: dto.contentJson,
          category: dto.category,
          icon: dto.icon,
          isDefault: false,
          spaceId: undefined,
          creatorId: userId,
        },
      });
      expect(result).toEqual(created);
    });

    // [OMA-W002-T005] Given non-admin sets isDefault: true, When create is called, Then isDefault is forced to false
    it('should force isDefault to false for non-admin users', async () => {
      const userId = 'user-1';
      const dto = {
        title: 'Candidate Default Template',
        contentJson: { type: 'doc', content: [] },
        isDefault: true,
      };
      mockPrisma.draftTemplates.create.mockResolvedValue({
        id: 'tmpl-x',
        ...dto,
        isDefault: false,
      });

      await service.create(userId, dto, 'user');

      expect(mockPrisma.draftTemplates.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDefault: false }),
        }),
      );
    });

    // [OMA-W002-T005] Given admin sets isDefault: true, When create is called, Then isDefault remains true
    it('should allow isDefault true for admin users', async () => {
      const userId = 'admin-1';
      const dto = {
        title: 'System Official Template',
        contentJson: { type: 'doc', content: [] },
        isDefault: true,
      };
      mockPrisma.draftTemplates.create.mockResolvedValue({
        id: 'tmpl-admin',
        ...dto,
        isDefault: true,
      });

      await service.create(userId, dto, 'admin');

      expect(mockPrisma.draftTemplates.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDefault: true }),
        }),
      );
    });

    // [OMA-W002-T005] Given spaceId not owned by user, When create is called, Then it throws ForbiddenException
    it('should throw ForbiddenException if user does not own specified workspace', async () => {
      const userId = 'user-1';
      const dto = {
        title: 'Scoped Template',
        contentJson: { type: 'doc', content: [] },
        spaceId: 'space-99',
      };
      mockPrisma.draftSpaces.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('delete', () => {
    // [OMA-W002-T005] Given template owned by user, When delete is called, Then it deletes template
    it('should delete template created by the user', async () => {
      // Arrange
      const userId = 'user-1';
      const templateId = 'tmpl-1';
      const template = { id: templateId, creatorId: userId };

      mockPrisma.draftTemplates.findUnique.mockResolvedValue(template);
      mockPrisma.draftTemplates.delete.mockResolvedValue(template);

      // Act
      const result = await service.delete(userId, templateId);

      // Assert
      expect(mockPrisma.draftTemplates.delete).toHaveBeenCalledWith({
        where: { id: templateId },
      });
      expect(result).toEqual({ deleted: true });
    });

    // [OMA-W002-T005] Given template created by someone else or global default, When delete is called, Then it throws ForbiddenException
    it('should throw ForbiddenException if user attempts to delete a template they did not create', async () => {
      // Arrange
      const userId = 'user-1';
      const templateId = 'tmpl-default';
      const foreignTemplate = {
        id: templateId,
        creatorId: 'admin-user',
        isDefault: true,
      };

      mockPrisma.draftTemplates.findUnique.mockResolvedValue(foreignTemplate);

      // Act & Assert
      await expect(service.delete(userId, templateId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.draftTemplates.delete).not.toHaveBeenCalled();
    });
  });
});
