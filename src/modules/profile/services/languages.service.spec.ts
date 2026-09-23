import { Test, TestingModule } from '@nestjs/testing';
import { LanguagesService } from './languages.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

interface ProfileServiceWithRecalculate {
  recalculate(userId: string): Promise<void>;
}

// Skipped until Batch 3 (T050)
describe.skip('LanguagesService', () => {
  let service: LanguagesService;
  let prismaService: PrismaService;
  let profileService: ProfileServiceWithRecalculate;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguagesService,
        {
          provide: PrismaService,
          useValue: {
            userLanguages: {
              count: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            languagesMaster: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ProfileService,
          useValue: {
            recalculate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LanguagesService>(LanguagesService);
    prismaService = module.get<PrismaService>(PrismaService);
    profileService = module.get<ProfileService>(
      ProfileService,
    ) as unknown as ProfileServiceWithRecalculate;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if user already has 5 languages', async () => {
      jest.spyOn(prismaService.userLanguages, 'count').mockResolvedValue(5);
      await expect(
        service.create('userId', {
          languageId: 'langId',
          proficiency: 'Native',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if language does not exist in master', async () => {
      jest.spyOn(prismaService.userLanguages, 'count').mockResolvedValue(2);
      jest
        .spyOn(prismaService.languagesMaster, 'findUnique')
        .mockResolvedValue(null);
      await expect(
        service.create('userId', {
          languageId: 'langId',
          proficiency: 'Native',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create a language', async () => {
      jest.spyOn(prismaService.userLanguages, 'count').mockResolvedValue(2);
      jest
        .spyOn(prismaService.languagesMaster, 'findUnique')
        .mockResolvedValue({
          id: 'langId',
          nameEn: 'English',
          nameAr: 'English',
          isoCode: 'en',
          isActive: true,
          sortOrder: 1,
        });
      jest
        .spyOn(prismaService.userLanguages, 'findUnique')
        .mockResolvedValue(null);
      jest.spyOn(prismaService.userLanguages, 'create').mockResolvedValue({
        userId: 'userId',
        languageId: 'langId',
        proficiencyLevelId: 'Native',
        isNative: false,
      });

      const result = await service.create('userId', {
        languageId: 'langId',
        proficiency: 'Native',
      });
      expect(result).toBeDefined();
      expect(
        jest.spyOn(prismaService.userLanguages, 'create'),
      ).toHaveBeenCalled();
      // Wait for async call to finish
      await new Promise((resolve) => process.nextTick(resolve));
      expect(jest.spyOn(profileService, 'recalculate')).toHaveBeenCalledWith(
        'userId',
      );
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if language not found', async () => {
      jest
        .spyOn(prismaService.userLanguages, 'findUnique')
        .mockResolvedValue(null);
      await expect(service.remove('userId', 'langId')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should successfully delete a language', async () => {
      jest.spyOn(prismaService.userLanguages, 'findUnique').mockResolvedValue({
        userId: 'userId',
        languageId: 'langId',
        proficiencyLevelId: 'Native',
        isNative: false,
      });
      jest.spyOn(prismaService.userLanguages, 'delete').mockResolvedValue({
        userId: 'userId',
        languageId: 'langId',
        proficiencyLevelId: 'Native',
        isNative: false,
      });

      await service.remove('userId', 'langId');
      expect(
        jest.spyOn(prismaService.userLanguages, 'delete'),
      ).toHaveBeenCalled();
      expect(jest.spyOn(profileService, 'recalculate')).toHaveBeenCalledWith(
        'userId',
      );
    });
  });
});
