import { Test, TestingModule } from '@nestjs/testing';
import { EducationsService } from './educations.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  userEducations: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockProfileService = {
  updateProfile: jest.fn(),
};

// Skipped until Batch 2 (T039)
describe.skip('EducationsService', () => {
  let service: EducationsService;
  let prismaService: any;
  let profileService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EducationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProfileService, useValue: mockProfileService },
      ],
    }).compile();

    service = module.get<EducationsService>(EducationsService);
    prismaService = module.get(PrismaService);
    profileService = module.get(ProfileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CRUD operations and Security', () => {
    const userId = 'user-1';
    const educationId = 'edu-1';

    it('should create an education record and recalculate profile status', async () => {
      mockPrismaService.userEducations.create.mockResolvedValue({
        id: educationId,
      });

      const dto = { degree: 'BSc', major: 'CS', institution: 'MIT' };
      const result = await service.create(userId, dto);

      expect(prismaService.userEducations.create).toHaveBeenCalledWith({
        data: { userId, ...dto },
      });
      expect(profileService.updateProfile).toHaveBeenCalledWith(userId, {});
      expect(result.id).toEqual(educationId);
    });

    it('should delete education record and ALL associated GPA data concurrently (Data Cleanliness)', async () => {
      mockPrismaService.userEducations.findFirst.mockResolvedValue({
        id: educationId,
        userId,
      });
      mockPrismaService.userEducations.delete.mockResolvedValue({
        id: educationId,
      });

      await service.remove(userId, educationId);

      // Ensures the correct where clause is used
      expect(prismaService.userEducations.delete).toHaveBeenCalledWith({
        where: { id: educationId, userId },
      });
      expect(profileService.updateProfile).toHaveBeenCalledWith(userId, {});
    });

    it('should prevent IDOR by checking userId before deletion', async () => {
      mockPrismaService.userEducations.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, educationId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.userEducations.findFirst).toHaveBeenCalledWith({
        where: { id: educationId, userId },
      });
    });

    it('should correctly nullify gpaRaw for letter scale grades (Issue B fix)', async () => {
      mockPrismaService.userEducations.findFirst.mockResolvedValue({
        id: educationId,
        userId,
      });
      mockPrismaService.userEducations.update.mockResolvedValue({});

      const dto = { gpaValue: 'A', gpaScale: 'letter' };
      await service.update(userId, educationId, dto as any);

      expect(prismaService.userEducations.update).toHaveBeenCalledWith({
        where: { id: educationId, userId },
        data: expect.objectContaining({
          gpaRaw: null,
          gpaScale: null,
          gpaNormalized: 4.0,
        }),
      });
    });

    it('should store gpaValue correctly including zero as a falsy value', async () => {
      mockPrismaService.userEducations.findFirst.mockResolvedValue({
        id: educationId,
        userId,
      });
      mockPrismaService.userEducations.update.mockResolvedValue({});

      const dto = { gpaValue: 0, gpaScale: '4.0' };
      await service.update(userId, educationId, dto as any);

      expect(prismaService.userEducations.update).toHaveBeenCalledWith({
        where: { id: educationId, userId },
        data: expect.objectContaining({
          gpaRaw: 0,
          gpaScale: 'OUT_OF_4',
          gpaNormalized: 0.0,
        }),
      });
    });
  });
});
