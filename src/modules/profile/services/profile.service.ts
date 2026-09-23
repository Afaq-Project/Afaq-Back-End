import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SystemSettingsService } from './system-settings.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { SystemSettingKeys } from '../constants/system-settings.keys';

const DEFAULT_GROUP_WEIGHTS = {
  personalIdentity: 18,
  locationOrigin: 15,
  education: 35,
  languages: 10,
  tests: 7,
  preferencesStatuses: 15,
} as const;

const DEFAULT_COMPONENTS = {
  personalIdentity: {
    firstName: 3,
    lastName: 3,
    dateOfBirth: 5,
    gender: 4,
    maritalStatusId: 3,
  },
  locationOrigin: {
    countryOfResidenceId: 8,
    nationalityId: 7,
  },
  education: {
    educationLevelId: 10,
    hasEducationRecord: 25,
  },
  languages: {
    hasLanguageRecord: 10,
  },
  tests: {
    hasTestRecord: 7,
  },
  preferencesStatuses: {
    hasTargetMajor: 5,
    hasTargetDegree: 4,
    hasTargetInstitution: 3,
    hasSpecialStatus: 3,
  },
} as const;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async getProfile(userId: string) {
    let profile = await this.prisma.userProfiles.findUnique({
      where: { userId },
      include: {
        specialStatuses: true,
        targetDegrees: true,
        targetMajors: true,
        targetInstitutions: true,
        educations: true,
        languages: true,
        testResults: true,
        documents: true,
      },
    });

    if (!profile) {
      profile = await this.prisma.userProfiles.create({
        data: { userId },
        include: {
          specialStatuses: true,
          targetDegrees: true,
          targetMajors: true,
          targetInstitutions: true,
          educations: true,
          languages: true,
          testResults: true,
          documents: true,
        },
      });
    }

    return profile;
  }

  /**
   * Updates a user profile with new data and triggers recalculation.
   * @param userId - The ID of the user whose profile is being updated.
   * @param data - The data to update the profile with.
   * @returns The updated profile.
   */
  /**
   * Updates user profile data.
   * FK existence is validated before update to avoid P2003 errors.
   */
  async updateProfile(userId: string, data: UpdateProfileDto) {
    const profile = await this.prisma.userProfiles.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (data.bio) {
      const maxBioLength = await this.systemSettingsService.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        1000,
      );
      if (data.bio.length > maxBioLength) {
        throw new BadRequestException({
          message: `Bio exceeds maximum length of ${maxBioLength}`,
          code: 'BIO_TOO_LONG',
        });
      }
    }

    if (data.experiences !== undefined) {
      const maxExperiences = await this.systemSettingsService.getNumber(
        SystemSettingKeys.MAX_EXPERIENCES,
        10,
      );
      if (data.experiences.length > maxExperiences) {
        throw new BadRequestException({
          message: `Experiences exceed maximum of ${maxExperiences} entries`,
          code: 'TOO_MANY_EXPERIENCES',
        });
      }
    }

    // ── FK existence validation ────────────────────────────────
    if (data.maritalStatusId !== undefined && data.maritalStatusId !== null) {
      const exists = await this.prisma.maritalStatuses.findUnique({
        where: { id: data.maritalStatusId },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestException({
          message: 'Marital status not found',
          code: 'INVALID_MARITAL_STATUS',
        });
      }
    }

    if (data.countryOfResidenceId !== undefined && data.countryOfResidenceId !== null) {
      const exists = await this.prisma.countries.findUnique({
        where: { id: data.countryOfResidenceId },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestException({
          message: 'Country not found',
          code: 'INVALID_COUNTRY',
        });
      }
    }

    if (data.nationalityId !== undefined && data.nationalityId !== null) {
      const exists = await this.prisma.countries.findUnique({
        where: { id: data.nationalityId },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestException({
          message: 'Country not found',
          code: 'INVALID_COUNTRY',
        });
      }
    }

    if (data.educationLevelId !== undefined && data.educationLevelId !== null) {
      const exists = await this.prisma.educationLevel.findUnique({
        where: { id: data.educationLevelId },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestException({
          message: 'Education level not found',
          code: 'INVALID_EDUCATION_LEVEL',
        });
      }
    }

    // clean undefined from data
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Coerce DTO date strings to native Date for Prisma.
    // @IsISO8601() accepts "2000-01-01", but Prisma's DateTime
    // requires a full ISO timestamp. Convert once here so every
    // downstream call sees a native Date.
    if (
      updateData.dateOfBirth !== undefined &&
      updateData.dateOfBirth !== null &&
      typeof updateData.dateOfBirth === 'string'
    ) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }

    const countryId =
      data.countryOfResidenceId !== undefined
        ? data.countryOfResidenceId
        : profile.countryOfResidenceId;
    const cityId =
      data.currentCityId !== undefined
        ? data.currentCityId
        : profile.currentCityId;

        if (cityId && countryId) {
      const city = await this.prisma.cities.findUnique({
        where: { id: cityId },
      });
      if (!city) {
        throw new BadRequestException({
          message: 'City not found',
          code: 'INVALID_CITY',
        });
      }
      if (city.countryId !== countryId) {
        if (data.currentCityId !== undefined) {
          throw new BadRequestException({
            message: 'City and country do not match',
            code: 'CITY_COUNTRY_MISMATCH',
          });
        } else {
          updateData.currentCityId = null;
        }
      }
    } else if (cityId && !countryId) {
      throw new BadRequestException({
        message: 'Cannot set city without a country of residence',
        code: 'CITY_WITHOUT_COUNTRY',
      });
    }

    await this.prisma.userProfiles.update({
      where: { userId },
      data: updateData,
    });

    await this.recalculate(userId);
    return this.getProfile(userId);
  }

  /**
   * Pure function computing the profile completion percentage.
   *
   * Reads the six group weights (already validated to total 100), scales each
   * documented component weight proportionally within its group, and scores
   * only the fields present on the profile.
   *
   * Excluded fields (never affect completion): bio, phone, email,
   * profilePhotoUrl, experiences, currentCityId, all Documents.
   */
  private computeCompletionPct(
    profile: Record<string, unknown>,
    groupWeights: Record<keyof typeof DEFAULT_GROUP_WEIGHTS, number>,
  ): number {
    const scale = (g: keyof typeof DEFAULT_GROUP_WEIGHTS): number =>
      groupWeights[g] / DEFAULT_GROUP_WEIGHTS[g];

    const hasArray = (key: string): boolean => {
      const value = profile[key];
      return Array.isArray(value) && value.length > 0;
    };

    let score = 0;

    // Personal Identity
    const pi = scale('personalIdentity');
    if (profile.firstName) {
      score += DEFAULT_COMPONENTS.personalIdentity.firstName * pi;
    }
    if (profile.lastName) {
      score += DEFAULT_COMPONENTS.personalIdentity.lastName * pi;
    }
    if (profile.dateOfBirth) {
      score += DEFAULT_COMPONENTS.personalIdentity.dateOfBirth * pi;
    }
    if (profile.gender) {
      score += DEFAULT_COMPONENTS.personalIdentity.gender * pi;
    }
    if (profile.maritalStatusId) {
      score += DEFAULT_COMPONENTS.personalIdentity.maritalStatusId * pi;
    }

    // Location Origin
    const lo = scale('locationOrigin');
    if (profile.countryOfResidenceId) {
      score += DEFAULT_COMPONENTS.locationOrigin.countryOfResidenceId * lo;
    }
    if (profile.nationalityId) {
      score += DEFAULT_COMPONENTS.locationOrigin.nationalityId * lo;
    }

    // Education
    const ed = scale('education');
    if (profile.educationLevelId) {
      score += DEFAULT_COMPONENTS.education.educationLevelId * ed;
    }
    if (hasArray('educations')) {
      score += DEFAULT_COMPONENTS.education.hasEducationRecord * ed;
    }

    // Languages
    if (hasArray('languages')) {
      score +=
        DEFAULT_COMPONENTS.languages.hasLanguageRecord * scale('languages');
    }

    // Tests
    if (hasArray('testResults')) {
      score += DEFAULT_COMPONENTS.tests.hasTestRecord * scale('tests');
    }

    // Preferences & Statuses
    const ps = scale('preferencesStatuses');
    if (hasArray('targetMajors')) {
      score += DEFAULT_COMPONENTS.preferencesStatuses.hasTargetMajor * ps;
    }
    if (hasArray('targetDegrees')) {
      score += DEFAULT_COMPONENTS.preferencesStatuses.hasTargetDegree * ps;
    }
    if (hasArray('targetInstitutions')) {
      score += DEFAULT_COMPONENTS.preferencesStatuses.hasTargetInstitution * ps;
    }
    if (hasArray('specialStatuses')) {
      score += DEFAULT_COMPONENTS.preferencesStatuses.hasSpecialStatus * ps;
    }

    return Math.round(score);
  }

  /**
   * Recalculates the profile completion percentage and matchable status based on current data and weights.
   * @param userId - The ID of the user whose profile is being recalculated.
   * @returns The updated profile with the new completion percentage and matching version.
   * @throws {InternalServerErrorException} If the total configured weights do not sum to 100.
   */
  async recalculate(userId: string) {
    const profile = await this.getProfile(userId);

    const weights = {
      personalIdentity: await this.systemSettingsService.getNumber(
        SystemSettingKeys.WEIGHT_PERSONAL_IDENTITY,
        18,
      ),
      locationOrigin: await this.systemSettingsService.getNumber(
        SystemSettingKeys.WEIGHT_LOCATION_ORIGIN,
        15,
      ),
      education: await this.systemSettingsService.getNumber(
        SystemSettingKeys.WEIGHT_EDUCATION,
        35,
      ),
      languages: await this.systemSettingsService.getNumber(
        SystemSettingKeys.WEIGHT_LANGUAGES,
        10,
      ),
      tests: await this.systemSettingsService.getNumber(
        SystemSettingKeys.WEIGHT_TESTS,
        7,
      ),
      preferencesStatuses: await this.systemSettingsService.getNumber(
        SystemSettingKeys.WEIGHT_PREFERENCES_STATUSES,
        15,
      ),
    };

    const totalConfiguredWeight = Object.values(weights).reduce(
      (sum, val) => sum + val,
      0,
    );

    if (totalConfiguredWeight !== 100) {
      throw new InternalServerErrorException(
        `Configured completion weights must total exactly 100. Current total is ${totalConfiguredWeight}.`,
      );
    }

    const completionPct = this.computeCompletionPct(profile, weights);

    const matchingThreshold = await this.systemSettingsService.getNumber(
      SystemSettingKeys.MATCHING_THRESHOLD,
      60,
    );
    const isMatchable = completionPct >= matchingThreshold;

    const updatedProfile = await this.prisma.userProfiles.update({
      where: { userId },
      data: {
        completionPct,
        isMatchable,
        matchingVersion: {
          increment: 1,
        },
      },
    });

    return updatedProfile;
  }
}
