import { Test, TestingModule } from '@nestjs/testing';
import { SkillsService } from './skills.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('SkillsService', () => {
  let service: SkillsService;

  const mockPrisma = {
    userSkills: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    skillsMaster: {
      findUnique: jest.fn(),
    },
  };

  const mockProfileService = {
    recalculateProfileStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProfileService, useValue: mockProfileService },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
    jest.clearAllMocks();
  });

  describe('getSkills', () => {
    it('should return user skills', async () => {
      mockPrisma.userSkills.findMany.mockResolvedValue([{ id: '1' }]);
      const result = await service.getSkills('userId');
      expect(result).toEqual([{ id: '1' }]);
    });
  });

  describe('addSkill', () => {
    it('should add a skill successfully', async () => {
      mockPrisma.userSkills.count.mockResolvedValue(5);
      mockPrisma.skillsMaster.findUnique.mockResolvedValue({
        id: 's1',
        isActive: true,
      });
      mockPrisma.userSkills.create.mockResolvedValue({
        id: '1',
        skillId: 's1',
      });

      const result = await service.addSkill('userId', {
        skillId: 's1',
        proficiency: 3,
      });

      expect(result).toEqual({ id: '1', skillId: 's1' });
      expect(mockProfileService.recalculateProfileStatus).toHaveBeenCalledWith(
        'userId',
      );
    });

    it('should throw BadRequestException if exceeding limit', async () => {
      mockPrisma.userSkills.count.mockResolvedValue(20);
      await expect(
        service.addSkill('userId', { skillId: 's1', proficiency: 3 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if skill inactive or invalid', async () => {
      mockPrisma.userSkills.count.mockResolvedValue(5);
      mockPrisma.skillsMaster.findUnique.mockResolvedValue({
        id: 's1',
        isActive: false,
      });
      await expect(
        service.addSkill('userId', { skillId: 's1', proficiency: 3 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException on duplicate P2002', async () => {
      mockPrisma.userSkills.count.mockResolvedValue(5);
      mockPrisma.skillsMaster.findUnique.mockResolvedValue({
        id: 's1',
        isActive: true,
      });
      mockPrisma.userSkills.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('msg', {
          code: 'P2002',
          clientVersion: '4.0.0',
        }),
      );

      await expect(
        service.addSkill('userId', { skillId: 's1', proficiency: 3 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeSkill', () => {
    it('should remove a skill and recalculate profile', async () => {
      mockPrisma.userSkills.delete.mockResolvedValue({ id: '1' });

      await service.removeSkill('userId', 's1');

      expect(mockPrisma.userSkills.delete).toHaveBeenCalledWith({
        where: { userId_skillId: { userId: 'userId', skillId: 's1' } },
      });
      expect(mockProfileService.recalculateProfileStatus).toHaveBeenCalledWith(
        'userId',
      );
    });
  });
});
