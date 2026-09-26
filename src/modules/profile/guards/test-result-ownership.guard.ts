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
export class TestResultOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id as string;
    const testResultId = request.params['id'] as string;

    if (!userId || !testResultId) {
      return true;
    }

    if (!isUUID(testResultId)) {
      throw new BadRequestException('Invalid UUID format');
    }

    const exists = await this.prisma.userTestResults.findFirst({
      where: { id: testResultId, userId },
    });

    if (!exists) {
      throw new NotFoundException({
        code: 'TEST_RESULT_NOT_FOUND',
        message: 'TEST_RESULT_NOT_FOUND',
      });
    }
    return true;
  }
}
