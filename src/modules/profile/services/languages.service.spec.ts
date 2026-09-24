import { Test, TestingModule } from '@nestjs/testing';
import { LanguagesService } from './languages.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('LanguagesService', () => {
  let service: LanguagesService;
  let prisma: PrismaService;
  let profileService: ProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguagesService,
        {
          provide: PrismaService,
          useValue: {
            languagesMaster: { findUnique: jest.fn() },
            proficiencyLevels: { findUnique: jest.fn() },
            systemSettings: { findUnique: jest.fn() },
            userLanguages: {
              count: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: ProfileService,
          useValue: { recalculate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<LanguagesService>(LanguagesService);
    prisma = module.get<PrismaService>(PrismaService);
    profileService = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if language not found', async () => {
      jest
        .spyOn(prisma.languagesMaster, 'findUnique')
        .mockResolvedValueOnce(null);
      await expect(
        service.create('user1', {
          languageId: 'lang1',
          proficiencyLevelId: 'prof1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if proficiency level not found', async () => {
      jest
        .spyOn(prisma.languagesMaster, 'findUnique')
        .mockResolvedValueOnce({ id: 'lang1' } as any);
      jest
        .spyOn(prisma.proficiencyLevels, 'findUnique')
        .mockResolvedValueOnce(null);
      await expect(
        service.create('user1', {
          languageId: 'lang1',
          proficiencyLevelId: 'prof1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if max languages reached', async () => {
      jest
        .spyOn(prisma.languagesMaster, 'findUnique')
        .mockResolvedValueOnce({ id: 'lang1' } as any);
      jest
        .spyOn(prisma.proficiencyLevels, 'findUnique')
        .mockResolvedValueOnce({ id: 'prof1' } as any);
      jest
        .spyOn(prisma.systemSettings, 'findUnique')
        .mockResolvedValueOnce({ value: '1' } as any);
      jest.spyOn(prisma.userLanguages, 'count').mockResolvedValueOnce(1);

      await expect(
        service.create('user1', {
          languageId: 'lang1',
          proficiencyLevelId: 'prof1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if duplicate language', async () => {
      jest
        .spyOn(prisma.languagesMaster, 'findUnique')
        .mockResolvedValueOnce({ id: 'lang1' } as any);
      jest
        .spyOn(prisma.proficiencyLevels, 'findUnique')
        .mockResolvedValueOnce({ id: 'prof1' } as any);
      jest
        .spyOn(prisma.systemSettings, 'findUnique')
        .mockResolvedValueOnce({ value: '10' } as any);
      jest.spyOn(prisma.userLanguages, 'count').mockResolvedValueOnce(1);
      jest
        .spyOn(prisma.userLanguages, 'findUnique')
        .mockResolvedValueOnce({ id: 'existing' } as any);

      await expect(
        service.create('user1', {
          languageId: 'lang1',
          proficiencyLevelId: 'prof1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user language', async () => {
      jest
        .spyOn(prisma.languagesMaster, 'findUnique')
        .mockResolvedValueOnce({ id: 'lang1' } as any);
      jest
        .spyOn(prisma.proficiencyLevels, 'findUnique')
        .mockResolvedValueOnce({ id: 'prof1' } as any);
      jest
        .spyOn(prisma.systemSettings, 'findUnique')
        .mockResolvedValueOnce(null); // default 10
      jest.spyOn(prisma.userLanguages, 'count').mockResolvedValueOnce(0);
      jest
        .spyOn(prisma.userLanguages, 'findUnique')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(prisma.userLanguages, 'create')
        .mockResolvedValueOnce({ id: 'new', isNative: true } as any);

      const result = await service.create('user1', {
        languageId: 'lang1',
        proficiencyLevelId: 'prof1',
        isNative: true,
      });
      expect(result).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(profileService.recalculate).toHaveBeenCalledWith('user1');
    });
  });

  describe('update', () => {
    it('should update user language', async () => {
      jest
        .spyOn(prisma.userLanguages, 'findUnique')
        .mockResolvedValueOnce({ id: 'existing' } as any);
      jest
        .spyOn(prisma.userLanguages, 'update')
        .mockResolvedValueOnce({ id: 'existing', isNative: false } as any);

      const result = await service.update('user1', 'lang1', {
        isNative: false,
      });
      expect(result).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(profileService.recalculate).toHaveBeenCalledWith('user1');
    });
  });
});
