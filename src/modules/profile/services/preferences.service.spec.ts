import { Test, TestingModule } from '@nestjs/testing';
import { PreferencesService } from './preferences.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { SystemSettingsService } from './system-settings.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('PreferencesService', () => {
  let service: PreferencesService;
  let prisma: any;
  let profileService: any;
  let systemSettingsService: any;

  beforeEach(async () => {
    prisma = {
      userTargetDegrees: {
        findMany: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      userTargetMajors: {
        findMany: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      userTargetInstitutions: {
        findMany: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      educationLevel: { findUnique: jest.fn() },
      majors: { findUnique: jest.fn() },
      institutions: { findUnique: jest.fn() },
    };

    profileService = { recalculate: jest.fn() };
    systemSettingsService = { getNumber: jest.fn().mockResolvedValue(5) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferencesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfileService, useValue: profileService },
        { provide: SystemSettingsService, useValue: systemSettingsService },
      ],
    }).compile();

    service = module.get<PreferencesService>(PreferencesService);
  });

  describe('getAll', () => {
    it('should return all preferences', async () => {
      prisma.userTargetDegrees.findMany.mockResolvedValue(['d1']);
      prisma.userTargetMajors.findMany.mockResolvedValue(['m1']);
      prisma.userTargetInstitutions.findMany.mockResolvedValue(['i1']);

      const res = await service.getAll('user-1');
      expect(res).toEqual({
        targetDegrees: ['d1'],
        targetMajors: ['m1'],
        targetInstitutions: ['i1'],
      });
    });
  });

  describe('addDegree', () => {
    it('should throw BadRequestException if education level invalid', async () => {
      prisma.educationLevel.findUnique.mockResolvedValue(null);
      await expect(service.addDegree('u1', 'id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if max limit reached', async () => {
      prisma.educationLevel.findUnique.mockResolvedValue({ id: 'id' });
      prisma.userTargetDegrees.count.mockResolvedValue(5);
      prisma.userTargetDegrees.findUnique.mockResolvedValue(null);

      await expect(service.addDegree('u1', 'id')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow re-submit if already exists even if max limit reached', async () => {
      prisma.educationLevel.findUnique.mockResolvedValue({ id: 'id' });
      prisma.userTargetDegrees.count.mockResolvedValue(5);
      prisma.userTargetDegrees.findUnique.mockResolvedValue({
        userId: 'u1',
        educationLevelId: 'id',
      });

      await service.addDegree('u1', 'id');
      expect(prisma.userTargetDegrees.upsert).toHaveBeenCalled();
      expect(profileService.recalculate).toHaveBeenCalled();
    });

    it('should add degree and recalculate', async () => {
      prisma.educationLevel.findUnique.mockResolvedValue({ id: 'id' });
      prisma.userTargetDegrees.count.mockResolvedValue(4);

      await service.addDegree('u1', 'id');
      expect(prisma.userTargetDegrees.upsert).toHaveBeenCalled();
      expect(profileService.recalculate).toHaveBeenCalled();
    });
  });

  describe('removeDegree', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.userTargetDegrees.findUnique.mockResolvedValue(null);
      await expect(service.removeDegree('u1', 'id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove degree and recalculate', async () => {
      prisma.userTargetDegrees.findUnique.mockResolvedValue({ id: 'id' });
      await service.removeDegree('u1', 'id');
      expect(prisma.userTargetDegrees.delete).toHaveBeenCalled();
      expect(profileService.recalculate).toHaveBeenCalled();
    });
  });

  describe('addMajor', () => {
    it('should throw BadRequestException if invalid', async () => {
      prisma.majors.findUnique.mockResolvedValue(null);
      await expect(service.addMajor('u1', 'id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if max limit reached', async () => {
      prisma.majors.findUnique.mockResolvedValue({ id: 'id' });
      prisma.userTargetMajors.count.mockResolvedValue(5);
      prisma.userTargetMajors.findUnique.mockResolvedValue(null);
      await expect(service.addMajor('u1', 'id')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should add major and recalculate', async () => {
      prisma.majors.findUnique.mockResolvedValue({ id: 'id' });
      prisma.userTargetMajors.count.mockResolvedValue(4);
      await service.addMajor('u1', 'id');
      expect(prisma.userTargetMajors.upsert).toHaveBeenCalled();
      expect(profileService.recalculate).toHaveBeenCalled();
    });
  });

  describe('removeMajor', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.userTargetMajors.findUnique.mockResolvedValue(null);
      await expect(service.removeMajor('u1', 'id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove and recalculate', async () => {
      prisma.userTargetMajors.findUnique.mockResolvedValue({ id: 'id' });
      await service.removeMajor('u1', 'id');
      expect(prisma.userTargetMajors.delete).toHaveBeenCalled();
      expect(profileService.recalculate).toHaveBeenCalled();
    });
  });

  describe('addInstitution', () => {
    it('should throw BadRequestException if invalid', async () => {
      prisma.institutions.findUnique.mockResolvedValue(null);
      await expect(service.addInstitution('u1', 'id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if max limit reached', async () => {
      prisma.institutions.findUnique.mockResolvedValue({ id: 'id' });
      prisma.userTargetInstitutions.count.mockResolvedValue(5);
      prisma.userTargetInstitutions.findUnique.mockResolvedValue(null);
      await expect(service.addInstitution('u1', 'id')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should add institution and recalculate', async () => {
      prisma.institutions.findUnique.mockResolvedValue({ id: 'id' });
      prisma.userTargetInstitutions.count.mockResolvedValue(4);
      await service.addInstitution('u1', 'id');
      expect(prisma.userTargetInstitutions.upsert).toHaveBeenCalled();
      expect(profileService.recalculate).toHaveBeenCalled();
    });
  });

  describe('removeInstitution', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.userTargetInstitutions.findUnique.mockResolvedValue(null);
      await expect(service.removeInstitution('u1', 'id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove and recalculate', async () => {
      prisma.userTargetInstitutions.findUnique.mockResolvedValue({ id: 'id' });
      await service.removeInstitution('u1', 'id');
      expect(prisma.userTargetInstitutions.delete).toHaveBeenCalled();
      expect(profileService.recalculate).toHaveBeenCalled();
    });
  });
});
