import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { CreateSkillDto } from '../dto/create-skill.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  async getSkills(userId: string) {
    return this.prisma.userSkills.findMany({
      where: { userId },
      include: { skill: true },
    });
  }

  async addSkill(userId: string, data: CreateSkillDto) {
    const count = await this.prisma.userSkills.count({ where: { userId } });
    if (count >= 20) {
      throw new BadRequestException('Maximum 20 skills allowed');
    }

    const master = await this.prisma.skillsMaster.findUnique({
      where: { id: data.skillId },
    });
    if (!master || !master.isActive) {
      throw new BadRequestException(
        'The selected item is invalid or inactive.',
      );
    }

    try {
      const created = await this.prisma.userSkills.create({
        data: { userId, skillId: data.skillId, proficiency: data.proficiency },
      });
      await this.profileService.recalculateProfileStatus(userId);
      return created;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'This item has already been added to your profile.',
        );
      }
      throw err;
    }
  }

  async removeSkill(userId: string, skillId: string) {
    try {
      await this.prisma.userSkills.delete({
        where: { userId_skillId: { userId, skillId } },
      });
      await this.profileService.recalculateProfileStatus(userId);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Skill not found in profile.');
      }
      throw err;
    }
  }
}
