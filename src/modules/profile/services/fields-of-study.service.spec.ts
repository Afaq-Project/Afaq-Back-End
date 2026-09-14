import { Test, TestingModule } from '@nestjs/testing';
import { FieldsOfStudyService } from './fields-of-study.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('FieldsOfStudyService', () => {
  let service: FieldsOfStudyService;

  const mockPrisma = {
    userFieldsOfStudy: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    fieldOfStudy: {
      findUnique: jest.fn(),
    },
  };

  const mockProfileService = {
    recalculateProfileStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FieldsOfStudyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProfileService, useValue: mockProfileService },
      ],
    }).compile();

    service = module.get<FieldsOfStudyService>(FieldsOfStudyService);
    jest.clearAllMocks();
  });

  describe('getFields', () => {
    it('should return user fields of study', async () => {
      mockPrisma.userFieldsOfStudy.findMany.mockResolvedValue([{ id: '1' }]);
      const result = await service.getFields('userId');
      expect(result).toEqual([{ id: '1' }]);
    });
  });

  describe('addField', () => {
    it('should add a field successfully', async () => {
      mockPrisma.userFieldsOfStudy.count.mockResolvedValue(2);
      mockPrisma.fieldOfStudy.findUnique.mockResolvedValue({
        id: 'f1',
        isActive: true,
      });
      mockPrisma.userFieldsOfStudy.create.mockResolvedValue({
        id: '1',
        fieldId: 'f1',
      });

      const result = await service.addField('userId', { fieldId: 'f1' });

      expect(result).toEqual({ id: '1', fieldId: 'f1' });
      expect(mockProfileService.recalculateProfileStatus).toHaveBeenCalledWith(
        'userId',
      );
    });

    it('should throw BadRequestException if exceeding limit', async () => {
      mockPrisma.userFieldsOfStudy.count.mockResolvedValue(5);
      await expect(
        service.addField('userId', { fieldId: 'f1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if field invalid or inactive', async () => {
      mockPrisma.userFieldsOfStudy.count.mockResolvedValue(2);
      mockPrisma.fieldOfStudy.findUnique.mockResolvedValue({
        id: 'f1',
        isActive: false,
      });
      await expect(
        service.addField('userId', { fieldId: 'f1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException on duplicate P2002', async () => {
      mockPrisma.userFieldsOfStudy.count.mockResolvedValue(2);
      mockPrisma.fieldOfStudy.findUnique.mockResolvedValue({
        id: 'f1',
        isActive: true,
      });
      mockPrisma.userFieldsOfStudy.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('msg', {
          code: 'P2002',
          clientVersion: '4.0.0',
        }),
      );

      await expect(
        service.addField('userId', { fieldId: 'f1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeField', () => {
    it('should remove a field and recalculate profile', async () => {
      mockPrisma.userFieldsOfStudy.delete.mockResolvedValue({ id: '1' });

      await service.removeField('userId', 'f1');

      expect(mockPrisma.userFieldsOfStudy.delete).toHaveBeenCalledWith({
        where: { userId_fieldId: { userId: 'userId', fieldId: 'f1' } },
      });
      expect(mockProfileService.recalculateProfileStatus).toHaveBeenCalledWith(
        'userId',
      );
    });
  });
});
