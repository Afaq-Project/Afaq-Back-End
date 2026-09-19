import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { CreateSkillDto } from '../dto/create-skill.dto';
import { UpdateSkillDto } from '../dto/update-skill.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { buildMeta } from '../../../common/utils/paginate.util';

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProfileService))
    private readonly profileService: ProfileService,
  ) {}

  async create(userId: string, dto: CreateSkillDto) {
    // Validate that the skillId exists in skillsMaster
    const skill = await this.prisma.skillsMaster.findUnique({
      where: { id: dto.skillId },
    });
    if (!skill) {
      throw new NotFoundException('Skill not found in master list');
    }

    // Check count to prevent adding more than 20 skills per user
    const count = await this.prisma.userSkills.count({
      where: { userId },
    });
    if (count >= 20) {
      throw new BadRequestException('Maximum of 20 skills allowed');
    }

    // Check if the user already has this skill
    const existing = await this.prisma.userSkills.findUnique({
      where: {
        userId_skillId: {
          userId,
          skillId: dto.skillId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('User already has this skill');
    }

    const userSkill = await this.prisma.userSkills.create({
      data: {
        userId,
        skillId: dto.skillId,
        proficiency: dto.proficiency,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await (this.profileService as any).recalculateProfileProgress(userId);

    return userSkill;
  }

  async findAll(userId: string, dto: PaginationDto) {
    const [skills, total] = await Promise.all([
      this.prisma.userSkills.findMany({
        where: { userId },
        skip: dto.skip,
        take: dto.limit,
        include: {
          skill: { select: { name: true } },
        },
      }),
      this.prisma.userSkills.count({ where: { userId } }),
    ]);

    return {
      data: skills.map((s) => ({
        skillId: s.skillId,
        name: s.skill.name,
        proficiency: s.proficiency,
      })),
      meta: buildMeta(total, dto.page, dto.limit),
    };
  }

  async findOne(userId: string, skillId: string) {
    const userSkill = await this.prisma.userSkills.findUnique({
      where: {
        userId_skillId: {
          userId,
          skillId,
        },
      },
      include: {
        skill: true,
      },
    });

    if (!userSkill) {
      throw new NotFoundException('User skill not found');
    }

    return userSkill;
  }

  async update(userId: string, skillId: string, dto: UpdateSkillDto) {
    // Check if the skill exists for the user
    await this.findOne(userId, skillId);

    const updatedSkill = await this.prisma.userSkills.update({
      where: {
        userId_skillId: {
          userId,
          skillId,
        },
      },
      data: {
        proficiency: dto.proficiency,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await (this.profileService as any).recalculateProfileProgress(userId);

    return updatedSkill;
  }

  async remove(userId: string, skillId: string) {
    // Check if the skill exists for the user
    await this.findOne(userId, skillId);

    await this.prisma.userSkills.delete({
      where: {
        userId_skillId: {
          userId,
          skillId,
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await (this.profileService as any).recalculateProfileProgress(userId);

    return { success: true };
  }
}
