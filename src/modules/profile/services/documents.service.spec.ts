import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE } from '../storage/storage.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('../utils/encryption.util', () => ({
  encryptFile: jest.fn(() => ({
    encrypted: Buffer.from('encrypted-data'),
    iv: '0102030405060708090a0b0c0d0e0f10',
  })),
}));

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
  };

  const mockStorage = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'storage.encryption.key') {
        return 'test-key-00000000000000000000000';
      }
      if (key === 'storage.limits.maxDocuments') {
        return 20;
      }
      if (key === 'storage.limits.signedUrlExpires') {
        return 300;
      }
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
        {
          provide: STORAGE_SERVICE,
          useValue: mockStorage,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadDocument', () => {
    const mockFile = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    } as Express.Multer.File;

    it('should throw BadRequestException if max documents reached', async () => {
      mockPrisma.documents.count.mockResolvedValue(20);
      await expect(service.uploadDocument('user-1', mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should upload document successfully', async () => {
      mockPrisma.documents.count.mockResolvedValue(5);
      mockStorage.upload.mockResolvedValue({ key: 'test-key' });
      const createdDoc = {
        id: 'doc-1',

        displayName: 'test.pdf',
        storagePath: 'test-key',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        createdAt: new Date(),
      };
      mockPrisma.documents.create.mockResolvedValue(createdDoc);

      const result = await service.uploadDocument('user-1', mockFile);

      expect(result).toEqual(createdDoc);
      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringMatching(/\.pdf$/),
        'application/pdf',
      );
      expect(mockPrisma.documents.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',

          displayName: 'test.pdf',
          storagePath: 'test-key',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('getDownloadUrl', () => {
    it('should throw NotFoundException if document not found', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue(null);
      await expect(service.getDownloadUrl('user-1', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own document', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue({
        userId: 'other-user',
      });
      await expect(service.getDownloadUrl('user-1', 'doc-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return signed URL successfully', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue({
        userId: 'user-1',
        storagePath: 'test-key',
      });
      mockStorage.getSignedUrl.mockResolvedValue('https://signed-url');

      const result = await service.getDownloadUrl('user-1', 'doc-1');
      expect(result.url).toBe('https://signed-url');
      expect(result.expiresAt).toBeDefined();
    });
  });

  describe('deleteDocument', () => {
    it('should throw NotFoundException if document not found', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue(null);
      await expect(service.deleteDocument('user-1', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own document', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue({
        userId: 'other-user',
      });
      await expect(service.deleteDocument('user-1', 'doc-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete document successfully', async () => {
      mockPrisma.documents.findUnique.mockResolvedValue({
        userId: 'user-1',
        storagePath: 'test-key',
      });

      await service.deleteDocument('user-1', 'doc-1');
      expect(mockStorage.delete).toHaveBeenCalledWith('test-key');
      expect(mockPrisma.documents.delete).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
    });
  });

  describe('getDocuments', () => {
    it('should return documents for user', async () => {
      const docs = [{ id: 'doc-1' }];
      mockPrisma.documents.findMany.mockResolvedValue(docs);
      mockPrisma.documents.count.mockResolvedValue(1);

      const result = await service.getDocuments('user-1', {
        page: 1,
        limit: 10,
        skip: 0,
      });
      expect(result.data).toEqual(docs);
      expect(result.meta.pagination.total).toBe(1);
      expect(mockPrisma.documents.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          mimeType: true,
          sizeBytes: true,
          displayName: true,

          createdAt: true,
          updatedAt: true,
        },
      });
    });
  });
});
