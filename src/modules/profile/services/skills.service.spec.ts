import { Test, TestingModule } from '@nestjs/testing';
import { SkillsService } from './skills.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SkillsService', () => {
  let service: SkillsService;

  const mockPrismaService = {
    skillsMaster: {
      findUnique: jest.fn(),
    },
    userSkills: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockProfileService = {
    recalculateProfileProgress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProfileService, useValue: mockProfileService },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a skill and call recalculateProfileProgress', async () => {
      mockPrismaService.skillsMaster.findUnique.mockResolvedValue({
        id: 'skill-1',
      });
      mockPrismaService.userSkills.count.mockResolvedValue(5);
      mockPrismaService.userSkills.findUnique.mockResolvedValue(null);
      mockPrismaService.userSkills.create.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
        proficiency: 3,
      });

      const result = await service.create('user-1', {
        skillId: 'skill-1',
        proficiency: 3,
      });

      expect(result).toEqual({
        userId: 'user-1',
        skillId: 'skill-1',
        proficiency: 3,
      });
      expect(
        mockProfileService.recalculateProfileProgress,
      ).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException if skill not found in skillsMaster', async () => {
      mockPrismaService.skillsMaster.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', { skillId: 'invalid-skill', proficiency: 3 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user already has 20 skills', async () => {
      mockPrismaService.skillsMaster.findUnique.mockResolvedValue({
        id: 'skill-1',
      });
      mockPrismaService.userSkills.count.mockResolvedValue(20);

      await expect(
        service.create('user-1', { skillId: 'skill-1', proficiency: 3 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user already has this skill', async () => {
      mockPrismaService.skillsMaster.findUnique.mockResolvedValue({
        id: 'skill-1',
      });
      mockPrismaService.userSkills.count.mockResolvedValue(5);
      mockPrismaService.userSkills.findUnique.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
      });

      await expect(
        service.create('user-1', { skillId: 'skill-1', proficiency: 3 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a skill and call recalculateProfileProgress', async () => {
      mockPrismaService.userSkills.findUnique.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
      });
      mockPrismaService.userSkills.update.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
        proficiency: 5,
      });

      const result = await service.update('user-1', 'skill-1', {
        proficiency: 5,
      });

      expect(result).toEqual({
        userId: 'user-1',
        skillId: 'skill-1',
        proficiency: 5,
      });
      expect(
        mockProfileService.recalculateProfileProgress,
      ).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException if skill does not exist', async () => {
      mockPrismaService.userSkills.findUnique.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'invalid-skill', { proficiency: 5 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a skill and call recalculateProfileProgress', async () => {
      mockPrismaService.userSkills.findUnique.mockResolvedValue({
        userId: 'user-1',
        skillId: 'skill-1',
      });

      const result = await service.remove('user-1', 'skill-1');

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.userSkills.delete).toHaveBeenCalled();
      expect(
        mockProfileService.recalculateProfileProgress,
      ).toHaveBeenCalledWith('user-1');
    });
  });
});
