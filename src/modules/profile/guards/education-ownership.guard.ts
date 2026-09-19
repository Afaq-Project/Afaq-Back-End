import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EducationOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const educationId = request.params.id;

    if (!userId || !educationId) {
      return true;
    }

    const exists = await this.prisma.userEducations.findFirst({
      where: { id: educationId, userId },
    });

    if (!exists) {
      throw new NotFoundException('Education record not found');
    }
    return true;
  }
}
