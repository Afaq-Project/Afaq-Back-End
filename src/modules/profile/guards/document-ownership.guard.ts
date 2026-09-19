import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DocumentOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const documentId = request.params.id;

    if (!userId || !documentId) {
      return true;
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
