import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { isUUID } from 'class-validator';

@Injectable()
export class SkillOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const skillId = request.params.skillId;

    if (!userId || !skillId) {
      return true;
    }

    if (!isUUID(skillId)) {
      throw new BadRequestException('Invalid UUID format');
    }

    const exists = await this.prisma.userSkills.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });

    if (!exists) {
      throw new NotFoundException('User skill not found');
    }
    return true;
  }
}
