import { Test, TestingModule } from '@nestjs/testing';
import { SpecialStatusesService } from './special-statuses.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SpecialStatusesService', () => {
  let service: SpecialStatusesService;
  let prisma: any;
  let profileService: any;

  beforeEach(async () => {
    prisma = {
      specialStatuses: {
        findUnique: jest.fn(),
      },
      userSpecialStatuses: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    profileService = {
      recalculate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpecialStatusesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfileService, useValue: profileService },
      ],
    }).compile();

    service = module.get<SpecialStatusesService>(SpecialStatusesService);
  });

  describe('add', () => {
    it('should throw BadRequestException if special status does not exist', async () => {
      prisma.specialStatuses.findUnique.mockResolvedValue(null);
      await expect(
        service.add('user-1', { specialStatusId: 'invalid-id' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upsert special status and recalculate profile', async () => {
      prisma.specialStatuses.findUnique.mockResolvedValue({ id: 'valid-id' });
      prisma.userSpecialStatuses.upsert.mockResolvedValue({});

      const result = await service.add('user-1', {
        specialStatusId: 'valid-id',
      });

      expect(result.success).toBe(true);
      expect(prisma.userSpecialStatuses.upsert).toHaveBeenCalledWith({
        where: {
          userId_specialStatusId: {
            userId: 'user-1',
            specialStatusId: 'valid-id',
          },
        },
        update: {},
        create: { userId: 'user-1', specialStatusId: 'valid-id' },
      });
      expect(profileService.recalculate).toHaveBeenCalledWith('user-1');
    });
  });

  describe('findAll', () => {
    it('should return statuses mapped correctly', async () => {
      prisma.userSpecialStatuses.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          specialStatusId: 'valid-id',
          status: { nameEn: 'en', nameAr: 'ar' },
        },
      ]);

      const result = await service.findAll('user-1');
      expect(result).toEqual([
        {
          userId: 'user-1',
          specialStatusId: 'valid-id',
          specialStatus: { nameEn: 'en', nameAr: 'ar' },
        },
      ]);
    });
  });

  describe('remove', () => {
    it('should delete special status and recalculate', async () => {
      prisma.userSpecialStatuses.delete.mockResolvedValue({});

      const result = await service.remove('user-1', 'valid-id');

      expect(result.success).toBe(true);
      expect(prisma.userSpecialStatuses.delete).toHaveBeenCalledWith({
        where: {
          userId_specialStatusId: {
            userId: 'user-1',
            specialStatusId: 'valid-id',
          },
        },
      });
      expect(profileService.recalculate).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException if delete fails', async () => {
      prisma.userSpecialStatuses.delete.mockRejectedValue(
        new Error('not found'),
      );

      await expect(service.remove('user-1', 'valid-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(profileService.recalculate).not.toHaveBeenCalled();
    });
  });
});
