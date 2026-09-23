import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma';

export interface CreateOAuthIdentityDto {
  userId: string;
  provider: string;
  providerUserId: string;
  accessTokenRef?: string | null;
  refreshTokenRef?: string | null;
}

export interface UpdateOAuthIdentityDto {
  accessTokenRef?: string | null;
  refreshTokenRef?: string | null;
}

@Injectable()
export class OauthIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProvider(provider: string, providerUserId: string) {
    return this.prisma.oauthIdentities.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: {
        user: {
          include: {
            userProfile: true,
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async create(data: CreateOAuthIdentityDto) {
    return this.prisma.oauthIdentities.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        providerUserId: data.providerUserId,
        accessTokenRef: data.accessTokenRef ?? null,
        refreshTokenRef: data.refreshTokenRef ?? null,
      },
    });
  }

  async update(id: string, data: UpdateOAuthIdentityDto) {
    return this.prisma.oauthIdentities.update({
      where: { id },
      data: {
        ...(data.accessTokenRef !== undefined
          ? { accessTokenRef: data.accessTokenRef }
          : {}),
        ...(data.refreshTokenRef !== undefined
          ? { refreshTokenRef: data.refreshTokenRef }
          : {}),
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.oauthIdentities.findMany({
      where: { userId },
    });
  }
}
