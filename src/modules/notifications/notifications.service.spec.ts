// [OMA-W002-T003] NotificationsService Spec
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrisma = {
    notificationTypes: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    notifications: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotification', () => {
    // [OMA-W002-T003] Given an existing notification type, When createNotification is called, Then it reuses the type and creates the notification
    it('should create notification using existing notification type', async () => {
      // Arrange
      const userId = 'user-123';
      const typeCode = 'DRAFT_FINALIZED';
      const payload = { documentId: 'doc-1' };
      const existingType = {
        id: 'type-1',
        code: typeCode,
        nameEn: 'Draft Finalized',
      };
      const createdNotification = {
        id: 'notif-1',
        userId,
        notificationTypeId: 'type-1',
        payload,
        createdAt: new Date(),
        readAt: null,
        notificationType: existingType,
      };

      mockPrisma.notificationTypes.findUnique.mockResolvedValue(existingType);
      mockPrisma.notifications.create.mockResolvedValue(createdNotification);

      // Act
      const result = await service.createNotification(
        userId,
        typeCode,
        payload,
      );

      // Assert
      expect(mockPrisma.notificationTypes.findUnique).toHaveBeenCalledWith({
        where: { code: typeCode },
      });
      expect(mockPrisma.notificationTypes.create).not.toHaveBeenCalled();
      expect(mockPrisma.notifications.create).toHaveBeenCalledWith({
        data: {
          userId,
          notificationTypeId: existingType.id,
          payload,
        },
        include: { notificationType: true },
      });
      expect(result).toEqual(createdNotification);
    });

    // [OMA-W002-T003] Given a non-existing notification type, When createNotification is called, Then it auto-creates the type and creates notification
    it('should create new notification type if it does not exist', async () => {
      // Arrange
      const userId = 'user-123';
      const typeCode = 'CUSTOM_ALERT';
      const payload = { alert: true };
      const newType = {
        id: 'type-new',
        code: typeCode,
        nameEn: 'CUSTOM ALERT',
        nameAr: 'CUSTOM ALERT',
      };

      mockPrisma.notificationTypes.findUnique.mockResolvedValue(null);
      mockPrisma.notificationTypes.create.mockResolvedValue(newType);
      mockPrisma.notifications.create.mockResolvedValue({
        id: 'notif-2',
        userId,
        notificationTypeId: newType.id,
        payload,
      });

      // Act
      const result = await service.createNotification(
        userId,
        typeCode,
        payload,
      );

      // Assert
      expect(mockPrisma.notificationTypes.create).toHaveBeenCalledWith({
        data: {
          code: typeCode,
          nameEn: 'CUSTOM ALERT',
          nameAr: 'CUSTOM ALERT',
        },
      });
      expect(mockPrisma.notifications.create).toHaveBeenCalledWith({
        data: {
          userId,
          notificationTypeId: newType.id,
          payload,
        },
        include: { notificationType: true },
      });
      expect(result.id).toBe('notif-2');
    });
  });

  describe('findAll', () => {
    // [OMA-W002-T003] Given user notifications, When findAll is called with pagination, Then it returns paginated items and metadata
    it('should return paginated notifications for the user', async () => {
      // Arrange
      const userId = 'user-123';
      const query = new NotificationQueryDto();
      query.page = 1;
      query.limit = 10;
      const items = [{ id: 'notif-1', userId, readAt: null }];
      const total = 1;

      mockPrisma.notifications.findMany.mockResolvedValue(items);
      mockPrisma.notifications.count.mockResolvedValue(total);

      // Act
      const result = await service.findAll(userId, query);

      // Assert
      expect(mockPrisma.notifications.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: { notificationType: true },
      });
      expect(result.data).toEqual(items);
      expect(result.meta.pagination.total).toBe(total);
      expect(result.meta.pagination.page).toBe(1);
    });

    // [OMA-W002-T003] Given unreadOnly flag is set, When findAll is called, Then it filters by readAt null
    it('should filter by unread notifications when unreadOnly is true', async () => {
      // Arrange
      const userId = 'user-123';
      const query = new NotificationQueryDto();
      query.unreadOnly = true;

      mockPrisma.notifications.findMany.mockResolvedValue([]);
      mockPrisma.notifications.count.mockResolvedValue(0);

      // Act
      await service.findAll(userId, query);

      // Assert
      expect(mockPrisma.notifications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, readAt: null },
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    // [OMA-W002-T003] Given user has unread notifications, When getUnreadCount is called, Then it returns count
    it('should return the unread notification count for user', async () => {
      // Arrange
      const userId = 'user-123';
      mockPrisma.notifications.count.mockResolvedValue(5);

      // Act
      const result = await service.getUnreadCount(userId);

      // Assert
      expect(mockPrisma.notifications.count).toHaveBeenCalledWith({
        where: { userId, readAt: null },
      });
      expect(result).toEqual({ unreadCount: 5 });
    });
  });

  describe('markAsRead', () => {
    // [OMA-W002-T003] Given an existing notification belonging to user, When markAsRead is called, Then it updates readAt
    it('should mark notification as read', async () => {
      // Arrange
      const userId = 'user-123';
      const notifId = 'notif-1';
      mockPrisma.notifications.findFirst.mockResolvedValue({
        id: notifId,
        userId,
      });
      mockPrisma.notifications.update.mockResolvedValue({
        id: notifId,
        readAt: new Date(),
        notificationType: { code: 'DRAFT_EXPORTED' },
      });

      // Act
      const result = await service.markAsRead(userId, notifId);

      // Assert
      expect(mockPrisma.notifications.update).toHaveBeenCalledWith({
        where: { id: notifId },
        data: { readAt: expect.any(Date) },
        include: { notificationType: true },
      });
      expect(result.id).toBe(notifId);
    });

    // [OMA-W002-T003] Given notification does not exist or belongs to another user (IDOR prevention), When markAsRead is called, Then it throws NotFoundException
    it('should throw NotFoundException if notification is not found for user (IDOR prevention)', async () => {
      // Arrange
      const userId = 'user-123';
      const foreignNotifId = 'notif-foreign';
      mockPrisma.notifications.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.markAsRead(userId, foreignNotifId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAsRead', () => {
    // [OMA-W004-T003] Test notifications markAllAsRead count response
    it('should mark all unread notifications as read for user', async () => {
      // Arrange
      const userId = 'user-123';
      mockPrisma.notifications.updateMany.mockResolvedValue({ count: 7 });

      // Act
      const result = await service.markAllAsRead(userId);

      // Assert
      expect(mockPrisma.notifications.updateMany).toHaveBeenCalledWith({
        where: { userId, readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(result).toEqual({ count: 7 });
    });
  });
});
