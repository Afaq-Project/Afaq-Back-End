// [OMA-W002-T005] DraftAttachmentsService Spec
jest.mock('uuid', () => ({ v4: () => '00000000-0000-0000-0000-000000000000' }));
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DraftAttachmentsService } from './draft-attachments.service';
import { DraftPagesService } from '../pages/draft-pages.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_SERVICE } from '../../profile/storage/storage.service';

describe('DraftAttachmentsService', () => {
  let service: DraftAttachmentsService;
  let mockPagesService: { findBySpaceAndId: jest.Mock };

  const mockPrisma = {
    draftAttachments: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockStorageService = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  const mockPage = {
    id: 'page-1',
    userId: 'user-1',
    spaceId: 'space-1',
    title: 'Proposal',
  };

  beforeEach(async () => {
    mockPagesService = {
      findBySpaceAndId: jest.fn().mockResolvedValue(mockPage),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftAttachmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DraftPagesService, useValue: mockPagesService },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<DraftAttachmentsService>(DraftAttachmentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    // [OMA-W002-T005] Given valid file and draft page, When upload is called, Then it uploads to storage and creates attachment
    it('should upload file to storage, create draft attachment record, and return signed url', async () => {
      // Arrange
      const userId = 'user-1';
      const spaceSlug = 'my-space';
      const pageId = 'page-1';
      const mockFile = {
        buffer: Buffer.from('file content'),
        originalname: 'certificate.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      } as Express.Multer.File;

      mockPagesService.findBySpaceAndId.mockResolvedValue(mockPage);
      mockStorageService.upload.mockResolvedValue({
        key: 'attachments/uuid-certificate.pdf',
      });
      mockStorageService.getSignedUrl.mockResolvedValue(
        'https://storage.afaq.com/signed-url',
      );

      const createdAttachment = {
        id: 'attach-1',
        pageId: mockPage.id,
        uploaderId: userId,
        filename: mockFile.originalname,
        mimeType: mockFile.mimetype,
        sizeBytes: mockFile.size,
        storagePath: 'attachments/uuid-certificate.pdf',
      };
      mockPrisma.draftAttachments.create.mockResolvedValue(createdAttachment);

      // Act
      const result = await service.upload(userId, spaceSlug, pageId, mockFile);

      // Assert
      expect(mockPagesService.findBySpaceAndId).toHaveBeenCalledWith(
        userId,
        spaceSlug,
        pageId,
      );
      expect(mockStorageService.upload).toHaveBeenCalledWith(
        mockFile.buffer,
        expect.stringContaining('attachments/'),
        mockFile.mimetype,
      );
      expect(mockPrisma.draftAttachments.create).toHaveBeenCalledWith({
        data: {
          pageId: mockPage.id,
          uploaderId: userId,
          filename: mockFile.originalname,
          mimeType: mockFile.mimetype,
          sizeBytes: mockFile.size,
          storagePath: 'attachments/uuid-certificate.pdf',
        },
      });
      expect(result).toEqual({
        ...createdAttachment,
        url: 'https://storage.afaq.com/signed-url',
      });
    });

    // [OMA-W002-T005] Given no file provided, When upload is called, Then it throws BadRequestException
    it('should throw BadRequestException if file is missing', async () => {
      // Arrange & Act & Assert
      await expect(
        service.upload('user-1', 'space-1', 'page-1', null as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDownloadUrl', () => {
    // [OMA-W004-T003] Test attachment getDownloadUrl key standardization
    it('should return signed download URL for attachment', async () => {
      // Arrange
      const userId = 'user-1';
      const attachmentId = 'attach-1';
      const attachment = {
        id: attachmentId,
        filename: 'resume.pdf',
        storagePath: 'attachments/resume.pdf',
        page: { userId },
      };

      mockPrisma.draftAttachments.findUnique.mockResolvedValue(attachment);
      mockStorageService.getSignedUrl.mockResolvedValue(
        'https://storage.afaq.com/download-url',
      );

      // Act
      const result = await service.getDownloadUrl(userId, attachmentId);

      // Assert
      expect(mockStorageService.getSignedUrl).toHaveBeenCalledWith(
        attachment.storagePath,
        3600,
      );
      expect(result).toEqual({
        downloadUrl: 'https://storage.afaq.com/download-url',
        filename: attachment.filename,
      });
    });

    // [OMA-W002-T005] Given attachment belongs to different user or not found, When getDownloadUrl is called, Then it throws NotFoundException (IDOR check)
    it('should throw NotFoundException if attachment is not found or belongs to another user', async () => {
      // Arrange
      const userId = 'user-1';
      const attachmentId = 'attach-1';
      const foreignAttachment = {
        id: attachmentId,
        filename: 'secret.pdf',
        storagePath: 'attachments/secret.pdf',
        page: { userId: 'user-2' }, // Foreign owner
      };

      mockPrisma.draftAttachments.findUnique.mockResolvedValue(
        foreignAttachment,
      );

      // Act & Assert
      await expect(
        service.getDownloadUrl(userId, attachmentId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    // [OMA-W002-T005] Given valid attachment owned by user, When delete is called, Then it removes from storage and DB
    it('should delete attachment from storage and DB', async () => {
      // Arrange
      const userId = 'user-1';
      const attachmentId = 'attach-1';
      const attachment = {
        id: attachmentId,
        storagePath: 'attachments/file.pdf',
        page: { userId },
      };

      mockPrisma.draftAttachments.findUnique.mockResolvedValue(attachment);
      mockStorageService.delete.mockResolvedValue(undefined);
      mockPrisma.draftAttachments.delete.mockResolvedValue(attachment);

      // Act
      const result = await service.delete(userId, attachmentId);

      // Assert
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        attachment.storagePath,
      );
      expect(mockPrisma.draftAttachments.delete).toHaveBeenCalledWith({
        where: { id: attachmentId },
      });
      expect(result).toEqual({ deleted: true });
    });

    // [OMA-W002-T005] Given attachment not found or foreign owner, When delete is called, Then it throws NotFoundException
    it('should throw NotFoundException on delete if attachment is not found or foreign (IDOR check)', async () => {
      // Arrange
      mockPrisma.draftAttachments.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('user-1', 'foreign-attach')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });
  });
});
