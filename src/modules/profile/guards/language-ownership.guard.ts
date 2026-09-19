import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class LanguageOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const languageId = request.params.languageId;

    if (!userId || !languageId) {
      return true;
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
