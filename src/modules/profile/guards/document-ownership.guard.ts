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
export class DocumentOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;
    const documentId = request.params.id;

    if (!userId || !documentId) {
      return true;
    }

    if (!isUUID(documentId)) {
      throw new BadRequestException('Invalid UUID format');
    }

    const exists = await this.prisma.documents.findFirst({
      where: { id: documentId, userId },
    });

    if (!exists) {
      throw new NotFoundException('Document not found');
    }
    return true;
  }
}
