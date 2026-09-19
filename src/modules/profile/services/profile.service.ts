import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateProfileDto } from '../dto/update-profile.dto';

export interface ProfileWithRelations {
  educationLevelId?: string | null;
  fieldOfStudy?: string[] | null;
  nationality?: string | null;
  dateOfBirth?: Date | null;
  currentCountry?: string | null;
  currentCity?: string | null;
  phone?: string | null;
  experienceLevel?: string | null;
  hasFinancialNeed?: boolean | null;
  careerGoals?: string | null;
  profilePhotoUrl?: string | null;
  user?: {
    userEducations?: unknown[];
    userSkills?: unknown[];
    userLanguages?: unknown[];
    documents?: unknown[];
  } | null;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    let profile = await this.prisma.userProfiles.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            userEducations: true,
            userSkills: {
              include: {
                skill: true,
              },
            },
            userLanguages: {
              include: {
                language: true,
              },
            },
            documents: true,
          },
        },
      },
    });

    if (!profile) {
      profile = await this.prisma.userProfiles.create({
        data: {
          userId,
          isDraft: true,
        },
        include: {
          user: {
            select: {
              userEducations: true,
              userSkills: {
                include: { skill: true },
              },
              userLanguages: {
                include: { language: true },
              },
              documents: true,
            },
          },
        },
      });
    }

    return profile;
  }

  isCoreFieldsComplete(profile: ProfileWithRelations): boolean {
    return !!(
      profile.educationLevelId?.trim() &&
      Array.isArray(profile.fieldOfStudy) &&
      profile.fieldOfStudy.length > 0 &&
      profile.nationality?.trim()
    );
  }

  calculateCompletionPct(profile: ProfileWithRelations): number {
    let pct = 0;
    if (profile.educationLevelId) {
      pct += 15;
    }
    if (profile.fieldOfStudy && profile.fieldOfStudy.length > 0) {
      pct += 15;
    }
    if (profile.nationality) {
      pct += 15;
    }
    if (profile.dateOfBirth) {
      pct += 5;
    }
    if (profile.currentCountry) {
      pct += 5;
    }
    if (profile.currentCity) {
      pct += 5;
    }
    if (profile.phone) {
      pct += 5;
    }
    if (profile.experienceLevel) {
      pct += 5;
    }
    if (
      profile.hasFinancialNeed !== null &&
      profile.hasFinancialNeed !== undefined
    ) {
      pct += 5;
    }
    if (profile.careerGoals && profile.careerGoals.length > 20) {
      pct += 5;
    }
    if (profile.user?.userSkills && profile.user.userSkills.length > 0) {
      pct += 10;
    }
    if (profile.user?.userLanguages && profile.user.userLanguages.length > 0) {
      pct += 5;
    }
    if (profile.profilePhotoUrl) {
      pct += 5;
    }
    return pct;
  }

  calculateLastCompletedStep(profile: ProfileWithRelations): number {
    let step = 0;

    // Step 1: Education
    if (
      profile.educationLevelId &&
      profile.fieldOfStudy &&
      profile.fieldOfStudy.length > 0 &&
      profile.nationality
    ) {
      step = 1;
    } else if (profile.educationLevelId && profile.nationality) {
      return 1; // Partial step 1
    }

    // Step 2: Background
    if (
      step === 1 &&
      (profile.experienceLevel ||
        (profile.hasFinancialNeed !== null &&
          profile.hasFinancialNeed !== undefined) ||
        profile.careerGoals)
    ) {
      step = 2;
    }

    // Step 3: Skills & Languages
    if (
      step === 2 &&
      profile.user?.userSkills &&
      profile.user.userSkills.length > 0 &&
      profile.user?.userLanguages &&
      profile.user.userLanguages.length > 0
    ) {
      step = 3;
    }

    // Step 4: Documents
    if (
      step === 3 &&
      profile.user?.documents &&
      profile.user.documents.length > 0
    ) {
      step = 4;
    }

    return step || (profile.nationality ? 1 : 0);
  }

  async getProfileWithDetails(userId: string) {
    const profile = await this.getProfile(userId);

    const educations = profile.user.userEducations;
    const skills = profile.user.userSkills.map(
      (us: {
        skillId: string;
        skill: { name: string };
        proficiency: number | null;
      }) => ({
        skillId: us.skillId,
        name: us.skill.name,
        proficiency: us.proficiency,
      }),
    );
    const languages = profile.user.userLanguages.map(
      (ul: {
        languageId: string;
        language: { name: string };
        proficiency: string;
      }) => ({
        languageId: ul.languageId,
        name: ul.language.name,
        proficiency: ul.proficiency,
      }),
    );
    const documents = profile.user.documents;

    const gpaNormalized4 =
      educations.length > 0 ? Number(educations[0].gpaNormalized4) : null;

    return {
      userId: profile.userId,
      fullName: profile.fullName,
      dateOfBirth: profile.dateOfBirth,
      nationality: profile.nationality,
      educationLevel: profile.educationLevelId,
      fieldOfStudy: profile.fieldOfStudy,
      currentCountry: profile.currentCountry,
      currentCity: profile.currentCity,
      phone: profile.phone,
      experienceLevel: profile.experienceLevel,
      hasFinancialNeed: profile.hasFinancialNeed,
      careerGoals: profile.careerGoals,
      profilePhotoUrl: profile.profilePhotoUrl,
      completionPct: this.calculateCompletionPct(profile),
      coreFieldsComplete: this.isCoreFieldsComplete(profile),
      lastCompletedStep: this.calculateLastCompletedStep(profile),
      gpaNormalized4:
        gpaNormalized4 === null || isNaN(gpaNormalized4)
          ? null
          : gpaNormalized4,
      isDraft: profile.isDraft,
      educations,
      skills,
      languages,
      documents,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const currentProfile = await this.prisma.userProfiles.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            userSkills: true,
            userLanguages: true,
            documents: true,
          },
        },
      },
    });

    if (!currentProfile) {
      throw new NotFoundException('Profile not found');
    }

    if (data.fieldOfStudy !== undefined && data.fieldOfStudy.length === 0) {
      throw new BadRequestException(
        'fieldOfStudy must contain at least one value',
      );
    }

    if (currentProfile.educationLevelId && data.educationLevelId === null) {
      throw new BadRequestException(
        'Cannot clear required field educationLevel',
      );
    }
    if (currentProfile.nationality && data.nationality === null) {
      throw new BadRequestException('Cannot clear required field nationality');
    }
    if (
      currentProfile.fieldOfStudy?.length > 0 &&
      data.fieldOfStudy &&
      data.fieldOfStudy.length === 0
    ) {
      throw new BadRequestException('Cannot clear required field fieldOfStudy');
    }

    const { educationLevelId, ...restData } = data;
    const profileData: Prisma.UserProfilesUncheckedUpdateInput = { ...restData };
    if (educationLevelId !== undefined) {
      profileData.educationLevelId = educationLevelId;
    }

    // Build a merged in-memory view of the profile after applying updates,
    // so we can calculate completionPct / isDraft without an extra DB round-trip.
    const mergedProfile: ProfileWithRelations = {
      ...currentProfile,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(profileData as any),
      user: {
        userSkills: currentProfile.user?.userSkills ?? [],
        userLanguages: currentProfile.user?.userLanguages ?? [],
        documents: currentProfile.user?.documents ?? [],
      },
    };

    const newPct = this.calculateCompletionPct(mergedProfile);
    const newIsCore = this.isCoreFieldsComplete(mergedProfile);

    // Single profile update (includes pct + isDraft)
    await this.prisma.userProfiles.update({
      where: { userId },
      data: {
        ...profileData,
        completionPct: newPct,
        isDraft: !newIsCore,
      },
    });

    // Single final read to return the fully-shaped response
    const result = await this.getProfileWithDetails(userId);
    return result;
  }

  async recalculateProfileProgress(userId: string) {
    const currentProfile = await this.prisma.userProfiles.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            userSkills: true,
            userLanguages: true,
            documents: true,
          },
        },
      },
    });

    if (!currentProfile) {
      throw new NotFoundException('Profile not found');
    }

    const mergedProfile: ProfileWithRelations = {
      ...currentProfile,
      user: {
        userSkills: currentProfile.user?.userSkills ?? [],
        userLanguages: currentProfile.user?.userLanguages ?? [],
        documents: currentProfile.user?.documents ?? [],
      },
    };

    const newPct = this.calculateCompletionPct(mergedProfile);
    const newIsCore = this.isCoreFieldsComplete(mergedProfile);

    await this.prisma.userProfiles.update({
      where: { userId },
      data: {
        completionPct: newPct,
        isDraft: !newIsCore,
      },
    });
  }
}
