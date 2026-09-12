import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ProfileService', () => {
  let service: ProfileService;

  const mockPrisma: any = {
    userProfiles: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userSkills: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    userLanguages: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    userEducations: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    skillsMaster: {
      findUnique: jest.fn(),
    },
    languagesMaster: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return existing profile', async () => {
      const mockProfile = { userId: '1', user: {} };
      mockPrisma.userProfiles.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfile('1');
      expect(result).toEqual(mockProfile);
      expect(mockPrisma.userProfiles.create).not.toHaveBeenCalled();
    });

    it('should create new profile if not found', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue(null);
      const newProfile = { userId: '2', isDraft: true, user: {} };
      mockPrisma.userProfiles.create.mockResolvedValue(newProfile);

      const result = await service.getProfile('2');
      expect(result).toEqual(newProfile);
      expect(mockPrisma.userProfiles.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: '2', isDraft: true } }),
      );
    });
  });

  describe('isCoreFieldsComplete', () => {
    it('should return false if missing fields', () => {
      expect(service.isCoreFieldsComplete({})).toBe(false);
      expect(service.isCoreFieldsComplete({ educationLevel: 'BS' })).toBe(
        false,
      );
      expect(
        service.isCoreFieldsComplete({
          educationLevel: 'BS',
          user: { userFieldsOfStudy: [{}] },
        }),
      ).toBe(false);
    });

    it('should return true if core fields present', () => {
      expect(
        service.isCoreFieldsComplete({
          educationLevel: 'BS',
          user: { userFieldsOfStudy: [{}] },
          nationality: 'US',
        }),
      ).toBe(true);
    });
  });

  describe('calculateCompletionPct', () => {
    it('should return 0 for empty profile', () => {
      expect(service.calculateCompletionPct({})).toBe(0);
    });

    it('should calculate correct percentage for fully populated profile', () => {
      const profile = {
        educationLevel: 'BS', // 15
        nationality: 'US', // 15
        dateOfBirth: new Date(), // 5
        currentCountry: 'US', // 5
        currentCity: 'NY', // 5
        phone: '123', // 5
        experienceLevel: 'Entry', // 5
        hasFinancialNeed: false, // 5
        careerGoals: 'To become a great software engineer and build products', // >20 chars -> 5
        profilePhotoUrl: 'url', // 5
        user: {
          userSkills: [{}], // 10
          userLanguages: [{}], // 5
          userFieldsOfStudy: [{}], // 15
        },
      };
      expect(service.calculateCompletionPct(profile)).toBe(100);
    });
  });

  describe('calculateLastCompletedStep', () => {
    it('should return 0 for empty profile', () => {
      expect(service.calculateLastCompletedStep({})).toBe(0);
    });

    it('should return 1 for partial step 1', () => {
      expect(
        service.calculateLastCompletedStep({
          educationLevel: 'BS',
          nationality: 'US',
        }),
      ).toBe(1);
    });

    it('should return 2 if step 1 is complete and partial step 2 exists', () => {
      expect(
        service.calculateLastCompletedStep({
          educationLevel: 'BS',
          user: { userFieldsOfStudy: [{}] },
          nationality: 'US',
          experienceLevel: 'Entry',
        }),
      ).toBe(2);
    });

    it('should return 3 if step 2 complete and skills/languages exist', () => {
      expect(
        service.calculateLastCompletedStep({
          educationLevel: 'BS',
          nationality: 'US',
          experienceLevel: 'Entry',
          user: {
            userSkills: [{}],
            userLanguages: [{}],
            userFieldsOfStudy: [{}],
          },
        }),
      ).toBe(3);
    });

    it('should return 4 if step 3 complete and documents exist', () => {
      expect(
        service.calculateLastCompletedStep({
          educationLevel: 'BS',
          nationality: 'US',
          experienceLevel: 'Entry',
          user: {
            userFieldsOfStudy: [{}],
            userSkills: [{}],
            userLanguages: [{}],
            documents: [{}],
          },
        }),
      ).toBe(4);
    });
  });

  describe('updateProfile', () => {
    it('should throw NotFoundException if profile does not exist', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue(null);
      await expect(service.updateProfile('1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clear GPA value if gpaScale provided without gpaValue', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
        user: {
          userEducations: [],
          userSkills: [],
          userLanguages: [],
          documents: [],
        },
      });
      mockPrisma.userEducations.findFirst.mockResolvedValue({ id: 'ed1' });
      await service.updateProfile('1', { gpaScale: '4.0' });
      expect(mockPrisma.userEducations.update).toHaveBeenCalledWith({
        where: { id: 'ed1' },
        data: {
          gpaRaw: null,
          gpaRawScale: 4.0,
          gpaNormalized4: null,
        },
      });
    });

    it('should throw BadRequestException if clearing required fields', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
        educationLevel: 'BS',
        nationality: 'US',
      });
      await expect(
        service.updateProfile('1', { educationLevel: null } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateProfile('1', { nationality: null } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update simple profile fields', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
        user: {
          userEducations: [],
          userSkills: [],
          userLanguages: [],
          documents: [],
        },
      });
      await service.updateProfile('1', { nationality: 'CA' });
      expect(mockPrisma.userProfiles.update).toHaveBeenCalledWith({
        where: { userId: '1' },
        data: expect.objectContaining({
          nationality: 'CA',
          completionPct: expect.any(Number),
          isDraft: expect.any(Boolean),
        }),
      });
    });

    it('should update GPA correctly', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
        user: {
          userEducations: [],
          userSkills: [],
          userLanguages: [],
          documents: [],
        },
      });
      mockPrisma.userEducations.findFirst.mockResolvedValue({ id: 'ed1' });

      await service.updateProfile('1', {
        gpaValue: 3.5,
        gpaScale: '4.0',
      });

      expect(mockPrisma.userEducations.update).toHaveBeenCalledWith({
        where: { id: 'ed1' },
        data: expect.objectContaining({
          gpaRaw: 3.5,
          gpaRawScale: 4.0,
          gpaNormalized4: 3.5,
        }),
      });
    });
  });
});
