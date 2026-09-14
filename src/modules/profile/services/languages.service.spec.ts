import { Test, TestingModule } from '@nestjs/testing';
import { LanguagesService } from './languages.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('LanguagesService', () => {
  let service: LanguagesService;

  const mockPrisma = {
    userLanguages: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    languagesMaster: {
      findUnique: jest.fn(),
    },
  };

  const mockProfileService = {
    recalculateProfileStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProfileService, useValue: mockProfileService },
      ],
    }).compile();

    service = module.get<LanguagesService>(LanguagesService);
    jest.clearAllMocks();
  });

  describe('getLanguages', () => {
    it('should return user languages', async () => {
      mockPrisma.userLanguages.findMany.mockResolvedValue([{ id: '1' }]);
      const result = await service.getLanguages('userId');
      expect(result).toEqual([{ id: '1' }]);
    });
  });

  describe('addLanguage', () => {
    it('should add a language successfully', async () => {
      mockPrisma.userLanguages.count.mockResolvedValue(2);
      mockPrisma.languagesMaster.findUnique.mockResolvedValue({ id: 'l1' });
      mockPrisma.userLanguages.create.mockResolvedValue({
        id: '1',
        languageId: 'l1',
      });

      const result = await service.addLanguage('userId', {
        languageId: 'l1',
        proficiency: 'fluent',
      });

      expect(result).toEqual({ id: '1', languageId: 'l1' });
      expect(mockProfileService.recalculateProfileStatus).toHaveBeenCalledWith(
        'userId',
      );
    });

    it('should throw BadRequestException if exceeding limit', async () => {
      mockPrisma.userLanguages.count.mockResolvedValue(5);
      await expect(
        service.addLanguage('userId', {
          languageId: 'l1',
          proficiency: 'fluent',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if language invalid', async () => {
      mockPrisma.userLanguages.count.mockResolvedValue(2);
      mockPrisma.languagesMaster.findUnique.mockResolvedValue(null);
      await expect(
        service.addLanguage('userId', {
          languageId: 'l1',
          proficiency: 'fluent',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException on duplicate P2002', async () => {
      mockPrisma.userLanguages.count.mockResolvedValue(2);
      mockPrisma.languagesMaster.findUnique.mockResolvedValue({ id: 'l1' });
      mockPrisma.userLanguages.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('msg', {
          code: 'P2002',
          clientVersion: '4.0.0',
        }),
      );

      await expect(
        service.addLanguage('userId', {
          languageId: 'l1',
          proficiency: 'fluent',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeLanguage', () => {
    it('should remove a language and recalculate profile', async () => {
      mockPrisma.userLanguages.delete.mockResolvedValue({ id: '1' });

      await service.removeLanguage('userId', 'l1');

      expect(mockPrisma.userLanguages.delete).toHaveBeenCalledWith({
        where: { userId_languageId: { userId: 'userId', languageId: 'l1' } },
      });
      expect(mockProfileService.recalculateProfileStatus).toHaveBeenCalledWith(
        'userId',
      );
    });
  });
});
