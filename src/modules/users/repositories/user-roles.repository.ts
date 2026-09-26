import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma';

const DEFAULT_USER_ROLE = 'USER';

@Injectable()
export class UserRolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentRoleName(userId: string): Promise<string> {
    const userRole = await this.prisma.userRoles.findFirst({
      where: { userId, isActive: true },
      include: {
        role: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return userRole?.role?.name ?? DEFAULT_USER_ROLE;
  }
}
