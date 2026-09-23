import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SystemSettingsService } from './system-settings.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SystemSettingKeys } from '../constants/system-settings.keys';

describe('ProfileService', () => {
  let service: ProfileService;

  const mockPrisma = {
    userProfiles: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cities: {
      findUnique: jest.fn(),
    },
  };

  const mockSystemSettingsService = {
    getNumber: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: SystemSettingsService,
          useValue: mockSystemSettingsService,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    jest.clearAllMocks();

    // Default mock for system settings
    mockSystemSettingsService.getNumber.mockImplementation(
      async (key, defaultValue) => {
        if (key === SystemSettingKeys.WEIGHT_PERSONAL_IDENTITY) {
          return 18;
        }
        if (key === SystemSettingKeys.WEIGHT_LOCATION_ORIGIN) {
          return 15;
        }
        if (key === SystemSettingKeys.WEIGHT_EDUCATION) {
          return 35;
        }
        if (key === SystemSettingKeys.WEIGHT_LANGUAGES) {
          return 10;
        }
        if (key === SystemSettingKeys.WEIGHT_TESTS) {
          return 7;
        }
        if (key === SystemSettingKeys.WEIGHT_PREFERENCES_STATUSES) {
          return 15;
        }
        return defaultValue;
      },
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return existing profile', async () => {
      const mockProfile = { userId: '1' };
      mockPrisma.userProfiles.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfile('1');
      expect(result).toEqual(mockProfile);
      expect(mockPrisma.userProfiles.create).not.toHaveBeenCalled();
    });

    it('[EC-001] Signup creates profile (create new if not found with only userId)', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue(null);
      const newProfile = { userId: '2', completionPct: 0, isMatchable: false };
      mockPrisma.userProfiles.create.mockResolvedValue(newProfile);

      const result = await service.getProfile('2');
      expect(result).toEqual(newProfile);
      expect(mockPrisma.userProfiles.create).toHaveBeenCalledWith({
        data: { userId: '2' },
        include: expect.any(Object),
      });
    });
  });

  describe('updateProfile', () => {
    it('should throw NotFoundException if profile does not exist', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue(null);
      await expect(service.updateProfile('1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('[EC-005] bio is exactly configured maximum succeeds, one over throws', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({ userId: '1' });
      mockSystemSettingsService.getNumber.mockImplementation(
        async (key, def) => {
          if (key === SystemSettingKeys.MAX_BIO_LENGTH) {
            return 10;
          }
          if (key === SystemSettingKeys.WEIGHT_PERSONAL_IDENTITY) {
            return 18;
          }
          if (key === SystemSettingKeys.WEIGHT_LOCATION_ORIGIN) {
            return 15;
          }
          if (key === SystemSettingKeys.WEIGHT_EDUCATION) {
            return 35;
          }
          if (key === SystemSettingKeys.WEIGHT_LANGUAGES) {
            return 10;
          }
          if (key === SystemSettingKeys.WEIGHT_TESTS) {
            return 7;
          }
          if (key === SystemSettingKeys.WEIGHT_PREFERENCES_STATUSES) {
            return 15;
          }
          return def;
        },
      );

      // Exactly max length
      mockPrisma.userProfiles.findUnique
        .mockResolvedValueOnce({ userId: '1' })
        .mockResolvedValueOnce({ userId: '1' }); // for recalculate
      mockPrisma.userProfiles.update.mockResolvedValue({});

      await expect(
        service.updateProfile('1', { bio: '1234567890' }),
      ).resolves.toBeDefined(); // should succeed

      // One over
      mockPrisma.userProfiles.findUnique.mockResolvedValue({ userId: '1' });
      await expect(
        service.updateProfile('1', { bio: '12345678901' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if city is provided without country', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({ userId: '1' });
      await expect(
        service.updateProfile('1', { currentCityId: 'city1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if city does not belong to the selected country explicitly', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({ userId: '1' });
      mockPrisma.cities.findUnique.mockResolvedValue({
        id: 'city1',
        countryId: 'country2',
      });

      await expect(
        service.updateProfile('1', {
          currentCityId: 'city1',
          countryOfResidenceId: 'country1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('[EC-006] changing country clears an incompatible existing city implicitly', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
        currentCityId: 'city1',
      });
      mockPrisma.cities.findUnique.mockResolvedValue({
        id: 'city1',
        countryId: 'oldCountry',
      });

      // Recalculate mocks
      mockPrisma.userProfiles.findUnique
        .mockResolvedValueOnce({ userId: '1', currentCityId: 'city1' })
        .mockResolvedValueOnce({ userId: '1' });

      await service.updateProfile('1', {
        countryOfResidenceId: 'newCountry',
      });

      // Update call should set currentCityId to null
      expect(mockPrisma.userProfiles.update).toHaveBeenCalledWith({
        where: { userId: '1' },
        data: expect.objectContaining({
          countryOfResidenceId: 'newCountry',
          currentCityId: null,
        }),
      });
    });

    it('[EC-002] partial personal update sends one valid field', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
      });

      mockPrisma.userProfiles.findUnique
        .mockResolvedValueOnce({ userId: '1' })
        .mockResolvedValueOnce({ userId: '1', firstName: 'John' });

      await service.updateProfile('1', {
        firstName: 'John',
      });

      expect(mockPrisma.userProfiles.update).toHaveBeenCalledWith({
        where: { userId: '1' },
        data: expect.objectContaining({
          firstName: 'John',
        }),
      });
    });

    it('[EC-011] passing null or explicitly setting fields preserves/clears them', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
      });
      mockPrisma.userProfiles.findUnique
        .mockResolvedValueOnce({ userId: '1' })
        .mockResolvedValueOnce({ userId: '1' });

      // passing null to clear a field
      await service.updateProfile('1', {
        firstName: null as any,
      });

      expect(mockPrisma.userProfiles.update).toHaveBeenCalledWith({
        where: { userId: '1' },
        data: expect.objectContaining({
          firstName: null,
        }),
      });
    });
  });

  describe('recalculate', () => {
    it('[EC-054] empty profile results in completionPct 0, isMatchable false', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({ userId: '1' }); // empty profile
      mockPrisma.userProfiles.update.mockResolvedValue({
        userId: '1',
        completionPct: 0,
        isMatchable: false,
      });

      await service.recalculate('1');

      expect(mockPrisma.userProfiles.update).toHaveBeenCalledWith({
        where: { userId: '1' },
        data: {
          completionPct: 0,
          isMatchable: false,
          matchingVersion: { increment: 1 },
        },
      });
    });

    it('[EC-057] all six weighted groups are filled resulting in 100% completion', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date(),
        gender: 'MALE',
        countryOfResidenceId: 'c1',
        nationalityId: 'n1',
        currentCityId: 'city1',
        educationLevelId: 'e1',
        educations: [{}],
        languages: [{}],
        testResults: [{}],
        targetDegrees: [{}],
        targetMajors: [{}],
        targetInstitutions: [{}],
        specialStatuses: [{}],
      });

      await service.recalculate('1');

      expect(mockPrisma.userProfiles.update).toHaveBeenCalledWith({
        where: { userId: '1' },
        data: {
          completionPct: 100,
          isMatchable: true,
          matchingVersion: { increment: 1 },
        },
      });
    });

    it('[EC-055] exactly configured threshold (default 60) reached transitions to matchable', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date(),
        gender: 'MALE', // 18
        educationLevelId: 'e1',
        educations: [{}], // 35
        testResults: [{}], // 7 -> 18+35+7 = 60
      });
      mockSystemSettingsService.getNumber.mockImplementation(
        async (key, def) => {
          if (key === SystemSettingKeys.MATCHING_THRESHOLD) {
            return 60;
          }
          if (key === SystemSettingKeys.WEIGHT_PERSONAL_IDENTITY) {
            return 18;
          }
          if (key === SystemSettingKeys.WEIGHT_LOCATION_ORIGIN) {
            return 15;
          }
          if (key === SystemSettingKeys.WEIGHT_EDUCATION) {
            return 35;
          }
          if (key === SystemSettingKeys.WEIGHT_LANGUAGES) {
            return 10;
          }
          if (key === SystemSettingKeys.WEIGHT_TESTS) {
            return 7;
          }
          if (key === SystemSettingKeys.WEIGHT_PREFERENCES_STATUSES) {
            return 15;
          }
          return def;
        },
      );

      await service.recalculate('1');

      expect(mockPrisma.userProfiles.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completionPct: 60,
            isMatchable: true,
            matchingVersion: { increment: 1 },
          }),
        }),
      );
    });

    it('[EC-056] previously matchable profile drops below threshold after mutation', async () => {
      // Simulate profile dropping some fields, resulting in a completion under 60
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
        firstName: 'John', // only 0.25 of 18 -> 4.5
      });
      mockSystemSettingsService.getNumber.mockImplementation(
        async (key, def) => {
          if (key === SystemSettingKeys.MATCHING_THRESHOLD) {
            return 60;
          }
          if (key === SystemSettingKeys.WEIGHT_PERSONAL_IDENTITY) {
            return 18;
          }
          if (key === SystemSettingKeys.WEIGHT_LOCATION_ORIGIN) {
            return 15;
          }
          if (key === SystemSettingKeys.WEIGHT_EDUCATION) {
            return 35;
          }
          if (key === SystemSettingKeys.WEIGHT_LANGUAGES) {
            return 10;
          }
          if (key === SystemSettingKeys.WEIGHT_TESTS) {
            return 7;
          }
          if (key === SystemSettingKeys.WEIGHT_PREFERENCES_STATUSES) {
            return 15;
          }
          return def;
        },
      );

      await service.recalculate('1');

      expect(mockPrisma.userProfiles.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completionPct: 5, // 4.5 rounded
            isMatchable: false, // Drops to false
            matchingVersion: { increment: 1 },
          }),
        }),
      );
    });

    it('should compute completionPct invariant checks accurately (partial location weight)', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: '1',
        countryOfResidenceId: 'c1',
        nationalityId: 'n1',
        // No city
      });

      await service.recalculate('1');

      // 0.34 * 15 + 0.33 * 15 = 5.1 + 4.95 = 10.05 => 10
      expect(mockPrisma.userProfiles.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completionPct: 10,
            isMatchable: false,
          }),
        }),
      );
    });
    it('[FR-010] should throw InternalServerErrorException if weights do not sum to 100', async () => {
      mockPrisma.userProfiles.findUnique.mockResolvedValue({ userId: '1' });
      mockSystemSettingsService.getNumber.mockImplementation(
        async (key, def) => {
          if (key === SystemSettingKeys.WEIGHT_PERSONAL_IDENTITY) {
            return 18;
          }
          if (key === SystemSettingKeys.WEIGHT_LOCATION_ORIGIN) {
            return 15;
          }
          if (key === SystemSettingKeys.WEIGHT_EDUCATION) {
            return 35;
          }
          if (key === SystemSettingKeys.WEIGHT_LANGUAGES) {
            return 10;
          }
          if (key === SystemSettingKeys.WEIGHT_TESTS) {
            return 7;
          }
          if (key === SystemSettingKeys.WEIGHT_PREFERENCES_STATUSES) {
            return 10;
          } // Sum is 95
          return def;
        },
      );

      await expect(service.recalculate('1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
