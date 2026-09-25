import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE } from '../storage/storage.service';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingKeys } from '../constants/system-settings.keys';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadDocumentDto } from '../dto/upload-document.dto';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockPrisma = {
    documents: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    documentTypes: {
      findUnique: jest.fn(),
    },
  };

  const mockStorage = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'storage.limits.maxDocuments') {
        return 20;
      }
      return null;
    }),
  };

  const mockSystemSettings = {
    getNumber: jest.fn((key: string, def: number) => {
      if (key === SystemSettingKeys.MAX_DOCUMENT_SIZE_BYTES) {
        return 5 * 1024 * 1024;
      }
      return def;
    }),
    getJson: jest.fn((key: string, def: any) => {
      if (key === SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES) {
        return ['application/pdf', 'image/jpeg', 'image/png'];
      }
      return def;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: STORAGE_SERVICE, useValue: mockStorage },
        { provide: SystemSettingsService, useValue: mockSystemSettings },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    jest.clearAllMocks();
  });

  describe('upload', () => {
    const validPdfBuffer = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46]),
      Buffer.from('test'),
    ]);
    const mockFile = {
      buffer: validPdfBuffer,
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    } as Express.Multer.File;
    const dto: UploadDocumentDto = { documentTypeId: 'type-1' };

    it('should throw BadRequestException if file size exceeds limit', async () => {
      const largeFile = { ...mockFile, size: 10 * 1024 * 1024 };
      await expect(service.upload('user-1', largeFile, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if mime type is invalid', async () => {
      const invalidMimeFile = { ...mockFile, mimetype: 'text/plain' };
      await expect(
        service.upload('user-1', invalidMimeFile, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if document type not found', async () => {
      mockPrisma.documentTypes.findUnique.mockResolvedValue(null);
      await expect(service.upload('user-1', mockFile, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException on PDF magic byte mismatch', async () => {
      mockPrisma.documentTypes.findUnique.mockResolvedValue({ id: 'type-1' });
      const badMagicFile = { ...mockFile, buffer: Buffer.from('badmagic') };
      await expect(service.upload('user-1', badMagicFile, dto)).rejects.toThrow(
        'DOCUMENT_TYPE_MISMATCH',
      );
    });

    it('should throw BadRequestException on JPEG magic byte mismatch', async () => {
      mockPrisma.documentTypes.findUnique.mockResolvedValue({ id: 'type-1' });
      const jpgFile = {
        ...mockFile,
        mimetype: 'image/jpeg',
        buffer: Buffer.from('badmagic'),
      };
      await expect(service.upload('user-1', jpgFile, dto)).rejects.toThrow(
        'DOCUMENT_TYPE_MISMATCH',
      );
    });

    it('should throw BadRequestException on PNG magic byte mismatch', async () => {
      mockPrisma.documentTypes.findUnique.mockResolvedValue({ id: 'type-1' });
      const pngFile = {
        ...mockFile,
        mimetype: 'image/png',
        buffer: Buffer.from('badmagic'),
      };
      await expect(service.upload('user-1', pngFile, dto)).rejects.toThrow(
        'DOCUMENT_TYPE_MISMATCH',
      );
    });

    it('should throw BadRequestException if max documents reached', async () => {
      mockPrisma.documentTypes.findUnique.mockResolvedValue({ id: 'type-1' });
      mockPrisma.documents.count.mockResolvedValue(20);
      await expect(service.upload('user-1', mockFile, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should rollback storage and throw error if DB create fails', async () => {
      mockPrisma.documentTypes.findUnique.mockResolvedValue({ id: 'type-1' });
      mockPrisma.documents.count.mockResolvedValue(0);
      mockStorage.upload.mockResolvedValue({ key: 'test-key' });

      const dbError = new Error('DB Error');
      mockPrisma.documents.create.mockRejectedValue(dbError);

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockStorage.delete.mockRejectedValue(new Error('Cleanup Error')); // also test catch logic

      await expect(service.upload('user-1', mockFile, dto)).rejects.toThrow(
        dbError,
      );
      expect(mockStorage.delete).toHaveBeenCalledWith('test-key');
      consoleSpy.mockRestore();
    });

    it('should successfully upload and create document', async () => {
      mockPrisma.documentTypes.findUnique.mockResolvedValue({ id: 'type-1' });
      mockPrisma.documents.count.mockResolvedValue(0);
      mockStorage.upload.mockResolvedValue({ key: 'test-key' });
      mockPrisma.documents.create.mockResolvedValue({ id: 'doc-1' });

      // Add a test without extension
      const noExtFile = { ...mockFile, originalname: 'test' };
      const res = await service.upload('user-1', noExtFile, dto);
      expect(res).toEqual({ id: 'doc-1' });
      expect(mockStorage.upload).toHaveBeenCalled();
    });
  });

  describe('getDownloadUrl', () => {
    it('should throw NotFoundException if document not found', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue(null);
      await expect(service.getDownloadUrl('user-1', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if user does not own document', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue({
        userId: 'other-user',
      });
      await expect(service.getDownloadUrl('user-1', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return signed URL successfully', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue({
        userId: 'user-1',
        storagePath: 'test-key',
      });
      mockStorage.getSignedUrl.mockResolvedValue('https://signed-url');
      const result = await service.getDownloadUrl('user-1', 'doc-1');
      expect(result.signedUrl).toBe('https://signed-url');
      expect(result.expiresIn).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if document not found', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue(null);
      await expect(service.delete('user-1', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if user does not own document', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue({
        userId: 'other-user',
      });
      await expect(service.delete('user-1', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not delete from DB if storage throws', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue({
        userId: 'user-1',
        storagePath: 'test-key',
      });
      mockStorage.delete.mockRejectedValue(new Error('Storage Error'));

      await expect(service.delete('user-1', 'doc-1')).rejects.toThrow(
        'Storage Error',
      );
      expect(mockPrisma.documents.delete).not.toHaveBeenCalled();
    });

    it('should delete document successfully', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue({
        userId: 'user-1',
        storagePath: 'test-key',
      });
      mockStorage.delete.mockResolvedValue(undefined);

      await service.delete('user-1', 'doc-1');
      expect(mockStorage.delete).toHaveBeenCalledWith('test-key');
      expect(mockPrisma.documents.delete).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
    });
  });

  describe('findAll', () => {
    it('should return documents for user with default pagination', async () => {
      const docs = [{ id: 'doc-1' }];
      mockPrisma.documents.findMany.mockResolvedValue(docs);
      mockPrisma.documents.count.mockResolvedValue(1);

      const result = await service.findAll('user-1');
      expect(result.data).toEqual(docs);
      expect(result.meta.pagination.total).toBe(1);
    });

    it('should return documents for user with provided pagination', async () => {
      const docs = [{ id: 'doc-1' }];
      mockPrisma.documents.findMany.mockResolvedValue(docs);
      mockPrisma.documents.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', {
        page: 2,
        limit: 5,
        skip: 5,
      });
      expect(result.data).toEqual(docs);
      expect(result.meta.pagination.total).toBe(1);
    });
  });
});
