import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import {
  normalizeGPA,
  validateGPARange,
} from '../../../common/utils/gpa-normalizer';

export interface ProfileWithRelations {
  educationLevel?: string | null;
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
    userSkills?: unknown[];
    userLanguages?: unknown[];
    documents?: unknown[];
    userFieldsOfStudy?: unknown[];
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
            userFieldsOfStudy: {
              include: {
                field: true,
              },
            },
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
              userFieldsOfStudy: {
                include: { field: true },
              },
            },
          },
        },
      });
    }

    return profile;
  }

  isCoreFieldsComplete(profile: ProfileWithRelations): boolean {
    return !!(
      profile.educationLevel?.trim() &&
      profile.user?.userFieldsOfStudy &&
      profile.user.userFieldsOfStudy.length > 0 &&
      profile.nationality?.trim()
    );
  }

  calculateCompletionPct(profile: ProfileWithRelations): number {
    let pct = 0;
    if (profile.educationLevel) {
      pct += 15;
    }
    if (
      profile.user?.userFieldsOfStudy &&
      profile.user.userFieldsOfStudy.length > 0
    ) {
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
      profile.educationLevel &&
      profile.user?.userFieldsOfStudy &&
      profile.user.userFieldsOfStudy.length > 0 &&
      profile.nationality
    ) {
      step = 1;
    } else if (profile.educationLevel && profile.nationality) {
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
    const fieldsOfStudy = (profile.user.userFieldsOfStudy || []).map(
      (uf: { fieldId: string; field: { name: string } }) => ({
        fieldId: uf.fieldId,
        name: uf.field.name,
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
      educationLevel: profile.educationLevel,
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
      fieldsOfStudy,
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
            userFieldsOfStudy: true,
            documents: true,
          },
        },
      },
    });

    if (!currentProfile) {
      throw new NotFoundException('Profile not found');
    }

    if (currentProfile.educationLevel && data.educationLevel === null) {
      throw new BadRequestException(
        'Cannot clear required field educationLevel',
      );
    }
    if (currentProfile.nationality && data.nationality === null) {
      throw new BadRequestException('Cannot clear required field nationality');
    }

    const { gpaValue, gpaScale, ...profileData } = data;

    // Build a merged in-memory view of the profile after applying updates,
    // so we can calculate completionPct / isDraft without an extra DB round-trip.
    const mergedProfile: ProfileWithRelations = {
      ...currentProfile,
      ...profileData,
      user: {
        userSkills: currentProfile.user?.userSkills ?? [],
        userLanguages: currentProfile.user?.userLanguages ?? [],
        userFieldsOfStudy: currentProfile.user?.userFieldsOfStudy ?? [],
        documents: currentProfile.user?.documents ?? [],
      },
    };

    const newPct = this.calculateCompletionPct(mergedProfile);
    const newIsCore = this.isCoreFieldsComplete(mergedProfile);

    await this.prisma.$transaction(
      async (prisma) => {
        // Single profile update (includes pct + isDraft)
        await prisma.userProfiles.update({
          where: { userId },
          data: {
            ...profileData,
            completionPct: newPct,
            isDraft: !newIsCore,
          },
        });

        if (gpaValue !== undefined && gpaScale) {
          if (!validateGPARange(gpaValue, gpaScale)) {
            throw new BadRequestException(
              'Invalid GPA range for selected scale',
            );
          }
          const normalized = normalizeGPA(gpaValue, gpaScale);
          const education = await prisma.userEducations.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          });
          if (!education) {
            throw new BadRequestException(
              'No education record found. Please add an education record before setting GPA.',
            );
          }
          await prisma.userEducations.update({
            where: { id: education.id },
            data: {
              gpaRaw: gpaValue ? parseFloat(gpaValue.toString()) : null,
              gpaRawScale:
                gpaScale === '4.0'
                  ? 4.0
                  : gpaScale === 'percentage'
                    ? 100
                    : null,
              gpaNormalized4: normalized,
            },
          });
        } else if (gpaScale && gpaValue === undefined) {
          const education = await prisma.userEducations.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          });
          if (!education) {
            throw new BadRequestException(
              'No education record found. Please add an education record before setting GPA.',
            );
          }
          await prisma.userEducations.update({
            where: { id: education.id },
            data: {
              gpaRaw: null,
              gpaRawScale:
                gpaScale === '4.0'
                  ? 4.0
                  : gpaScale === 'percentage'
                    ? 100
                    : null,
              gpaNormalized4: null,
            },
          });
        }
      },
      { timeout: 30000 },
    );
    // Single final read to return the fully-shaped response
    const result = await this.getProfileWithDetails(userId);
    return result;
  }
  async recalculateProfileStatus(userId: string): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      return;
    }
    const completionPct = this.calculateCompletionPct(profile);
    const isDraft = !this.isCoreFieldsComplete(profile);
    await this.prisma.userProfiles.update({
      where: { userId },
      data: { completionPct, isDraft },
    });
  }
}
