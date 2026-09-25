import { RequestWithUser } from '@common/decorators';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SpecialStatusOwnershipGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;
    const specialStatusId = request.params.specialStatusId;

    if (!userId) {
      return false;
    }

    if (request.method === 'DELETE' && specialStatusId) {
      const exists = await this.prisma.userSpecialStatuses.findUnique({
        where: {
          userId_specialStatusId: {
            userId,
            specialStatusId,
          },
        },
      });

      if (!exists) {
        throw new NotFoundException({
          code: 'SPECIAL_STATUS_NOT_FOUND',
          message: 'Special status not found',
        });
      }
    }

    return true;
  }
}
