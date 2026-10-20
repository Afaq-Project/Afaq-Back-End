// [OMA-W002-T003] NotificationsService
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { buildMeta } from '../../common/utils/paginate.util';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    userId: string,
    typeCode: string,
    payload: Record<string, unknown> = {},
  ) {
    let notificationType = await this.prisma.notificationTypes.findUnique({
      where: { code: typeCode },
    });

    if (!notificationType) {
      notificationType = await this.prisma.notificationTypes.create({
        data: {
          code: typeCode,
          nameEn: typeCode.replace(/_/g, ' '),
          nameAr: typeCode.replace(/_/g, ' '),
        },
      });
    }

    return this.prisma.notifications.create({
      data: {
        userId,
        notificationTypeId: notificationType.id,
        payload: payload as Prisma.InputJsonValue,
      },
      include: {
        notificationType: true,
      },
    });
  }

  async findAll(userId: string, query: NotificationQueryDto) {
    const where: Prisma.NotificationsWhereInput = { userId };
    if (query.unreadOnly) {
      where.readAt = null;
    }

    const [items, total] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: {
          notificationType: true,
        },
      }),
      this.prisma.notifications.count({ where }),
    ]);

    return {
      data: items,
      meta: buildMeta(total, query.page, query.limit),
    };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const count = await this.prisma.notifications.count({
      where: {
        userId,
        readAt: null,
      },
    });
    return { unreadCount: count };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notifications.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }

    return this.prisma.notifications.update({
      where: { id },
      data: { readAt: new Date() },
      include: { notificationType: true },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notifications.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    // [OMA-W004-T003] Return standard count for markAllAsRead
    return { count: result.count };
  }
}
