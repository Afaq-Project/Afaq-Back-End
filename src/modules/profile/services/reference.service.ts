import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getFieldsOfStudy() {
    return this.prisma.fieldOfStudy.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getSkillsTaxonomy() {
    const skills = await this.prisma.skillsMaster.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    const taxonomy = skills.reduce(
      (acc, skill) => {
        const { category, ...rest } = skill;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(rest);
        return acc;
      },
      {} as Record<string, { id: string; name: string }[]>,
    );

    return Object.entries(taxonomy).map(([category, categorySkills]) => ({
      category,
      skills: categorySkills,
    }));
  }

  async getLanguages() {
    return this.prisma.languagesMaster.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
