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

    // clean undefined from data
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
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
      if (city && city.countryId !== countryId) {
        if (data.currentCityId !== undefined) {
          throw new BadRequestException({
            message: 'City and country do not match',
            code: 'CITY_COUNTRY_MISMATCH',
          });
        } else {
          // EC-006: changing country clears an incompatible existing city
          updateData.currentCityId = null;
        }
      }
    } else if (cityId && !countryId) {
      throw new BadRequestException(
        'Cannot set city without a country of residence',
      );
    }

    await this.prisma.userProfiles.update({
      where: { userId },
      data: updateData,
    });

    return this.recalculate(userId);
  }

  /**
   * Pure function to compute completion percentage based on profile and weights.
   * @param profile - The profile object.
   * @param weights - The configured weights.
   * @returns The computed completion percentage.
   */
  private computeCompletionPct(
    profile: Record<string, any>,
    weights: Record<string, number>,
  ): number {
    let totalWeight = 0;

    // Personal Identity: firstName, lastName, dateOfBirth, gender
    let personalScore = 0;
    if (profile.firstName) {
      personalScore += 0.25;
    }
    if (profile.lastName) {
      personalScore += 0.25;
    }
    if (profile.dateOfBirth) {
      personalScore += 0.25;
    }
    if (profile.gender) {
      personalScore += 0.25;
    }
    totalWeight += personalScore * weights.personalIdentity;

    // Location Origin: countryOfResidenceId, nationalityId, currentCityId
    let locationScore = 0;
    if (profile.countryOfResidenceId) {
      locationScore += 0.34;
    }
    if (profile.nationalityId) {
      locationScore += 0.33;
    }
    if (profile.currentCityId) {
      locationScore += 0.33;
    }
    totalWeight += locationScore * weights.locationOrigin;

    // Education
    let educationScore = 0;
    if (profile.educationLevelId) {
      educationScore += 0.5;
    }
    if (profile.educations && profile.educations.length > 0) {
      educationScore += 0.5;
    }
    totalWeight += educationScore * weights.education;

    // Languages
    if (profile.languages && profile.languages.length > 0) {
      totalWeight += weights.languages;
    }

    // Tests
    if (profile.testResults && profile.testResults.length > 0) {
      totalWeight += weights.tests;
    }

    // Preferences & Statuses
    let prefScore = 0;
    if (profile.targetDegrees && profile.targetDegrees.length > 0) {
      prefScore += 0.25;
    }
    if (profile.targetMajors && profile.targetMajors.length > 0) {
      prefScore += 0.25;
    }
    if (profile.targetInstitutions && profile.targetInstitutions.length > 0) {
      prefScore += 0.25;
    }
    if (profile.specialStatuses && profile.specialStatuses.length > 0) {
      prefScore += 0.25;
    }
    totalWeight += prefScore * weights.preferencesStatuses;

    return Math.round(totalWeight);
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
