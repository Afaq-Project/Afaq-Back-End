import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { isUUID } from 'class-validator';
import { RequestWithUser } from '@common/decorators';

@Injectable()
export class LanguageOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id as string;
    const languageId = request.params['languageId'] as string;

    if (!userId || !languageId) {
      return true;
    }

    if (!isUUID(languageId)) {
      throw new BadRequestException('Invalid UUID format');
    }

    const exists = await this.prisma.userLanguages.findUnique({
      where: { userId_languageId: { userId, languageId } },
    });

    if (!exists) {
      throw new NotFoundException('User language not found');
    }
    return true;
  }
}
