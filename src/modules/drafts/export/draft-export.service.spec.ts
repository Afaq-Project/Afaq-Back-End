// [OMA-W002-T008] DraftExportService Spec
jest.mock('uuid', () => ({ v4: () => '00000000-0000-0000-0000-000000000000' }));
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DraftExportService } from './draft-export.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE } from '../../profile/storage/storage.service';
import { DraftPageStatus } from '@prisma/client';

describe('DraftExportService', () => {
  let service: DraftExportService;

  const mockPrisma = {
    draftPages: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    draftPageVersions: {
      create: jest.fn(),
    },
    userProfiles: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    documents: {
      count: jest.fn(),
      create: jest.fn(),
    },
    documentTypes: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockStorageService = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'storage.limits.maxDocuments') {
        return 20;
      }
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftExportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<DraftExportService>(DraftExportService);
    jest.clearAllMocks();
    mockStorageService.getSignedUrl.mockResolvedValue(
      'https://storage.afaq.com/signed-pdf-url',
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('compilePdf', () => {
    // [OMA-W005-T003] Test pdfmake AST conversion and valid PDF buffer generation
    it('should compile rich AST with headings, marks, lists, blockquote, codeBlock, and horizontalRule into valid PDF buffer', async () => {
      // Arrange
      const title = 'Comprehensive Resume Draft';
      const richAst = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Main Heading (H1)' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Section Heading (H2)' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Subsection Heading (H3)' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Bold text', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' ' },
              {
                type: 'text',
                text: 'Italic text',
                marks: [{ type: 'italic' }],
              },
              { type: 'text', text: ' ' },
              {
                type: 'text',
                text: 'Strikethrough text',
                marks: [{ type: 'strike' }],
              },
              { type: 'text', text: ' ' },
              {
                type: 'text',
                text: 'Underlined text',
                marks: [{ type: 'underline' }],
              },
              { type: 'text', text: ' ' },
              { type: 'text', text: 'Inline code', marks: [{ type: 'code' }] },
              { type: 'text', text: ' ' },
              {
                type: 'text',
                text: 'External Link',
                marks: [{ type: 'link', attrs: { href: 'https://afaq.org' } }],
              },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'First bullet item' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Second bullet item' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Step 1' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Step 2' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Quoted wisdom' }],
              },
            ],
          },
          {
            type: 'codeBlock',
            content: [{ text: 'const greeting = "Hello Afaq";' }],
          },
          {
            type: 'horizontalRule',
          },
        ],
      };

      // Act
      const result = await service.compilePdf(title, richAst);

      // Assert
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      expect(result.toString('utf-8', 0, 5)).toBe('%PDF-');
    });

    // [OMA-W005-T003] Test pdfmake AST conversion and valid PDF buffer generation
    it('should generate valid PDF buffer for plain string content', async () => {
      // Arrange
      const title = 'Plain Text Draft';
      const plainContent =
        'This is a simple plain text note without ProseMirror AST structure.';

      // Act
      const result = await service.compilePdf(title, plainContent);

      // Assert
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.toString('utf-8', 0, 5)).toBe('%PDF-');
    });

    // [OMA-W005-T003] Test pdfmake AST conversion and valid PDF buffer generation
    it('should generate valid PDF buffer when contentJson is serialized JSON string', async () => {
      // Arrange
      const title = 'Serialized JSON Draft';
      const serializedJson = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Parsed from JSON string' }],
          },
        ],
      });

      // Act
      const result = await service.compilePdf(title, serializedJson);

      // Assert
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.toString('utf-8', 0, 5)).toBe('%PDF-');
    });

    // [OMA-W005-T003] Test pdfmake AST conversion and valid PDF buffer generation
    it('should generate valid PDF buffer when contentJson is null or empty', async () => {
      // Arrange
      const title = 'Empty Draft';

      // Act
      const resultNull = await service.compilePdf(title, null);
      const resultEmptyObj = await service.compilePdf(title, {});

      // Assert
      expect(Buffer.isBuffer(resultNull)).toBe(true);
      expect(resultNull.length).toBeGreaterThan(0);
      expect(resultNull.toString('utf-8', 0, 5)).toBe('%PDF-');

      expect(Buffer.isBuffer(resultEmptyObj)).toBe(true);
      expect(resultEmptyObj.length).toBeGreaterThan(0);
      expect(resultEmptyObj.toString('utf-8', 0, 5)).toBe('%PDF-');
    });
  });

  describe('finalize', () => {
    // [OMA-W004-T002] Test finalize composite workflow response DTO
    it('should finalize draft into official document, lock page, and record version snapshot', async () => {
      // Arrange
      const userId = 'user-1';
      const pageId = 'page-1';
      const draftPage = {
        id: pageId,
        userId,
        title: 'Statement of Purpose',
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', text: 'SOP Content' }],
        },
        status: DraftPageStatus.IN_PROGRESS,
      };

      mockPrisma.draftPages.findFirst.mockResolvedValue(draftPage);
      mockPrisma.userProfiles.findUnique.mockResolvedValue({ userId });
      mockPrisma.documents.count.mockResolvedValue(2);
      mockPrisma.documentTypes.findUnique.mockResolvedValue({
        id: 'type-sop',
        name: 'SOP',
      });

      mockStorageService.upload.mockResolvedValue({
        key: 'documents/user-1/uuid-sop.pdf',
      });
      mockStorageService.getSignedUrl.mockResolvedValue(
        'https://storage.afaq.com/signed-sop.pdf',
      );

      const createdDoc = {
        id: 'doc-final-1',
        userId,
        documentTypeId: 'type-sop',
        displayName: 'My SOP.pdf',
        storagePath: 'documents/user-1/uuid-sop.pdf',
        sizeBytes: 1024,
      };
      mockPrisma.documents.create.mockResolvedValue(createdDoc);
      mockPrisma.draftPages.update.mockResolvedValue({
        ...draftPage,
        status: DraftPageStatus.FINALIZED,
        documentId: createdDoc.id,
      });

      // Act
      const result = await service.finalize(userId, pageId, {
        documentTypeId: 'type-sop',
        displayName: 'My SOP.pdf',
      });

      // Assert
      expect(mockStorageService.upload).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('documents/user-1/'),
        'application/pdf',
      );
      expect(mockPrisma.documents.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          documentTypeId: 'type-sop',
          displayName: 'My SOP.pdf',
          mimeType: 'application/pdf',
        }),
        include: { documentType: true },
      });
      expect(mockPrisma.draftPages.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: {
          status: DraftPageStatus.FINALIZED,
          documentId: createdDoc.id,
        },
      });
      expect(mockPrisma.draftPageVersions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pageId,
          userId,
          isFinalizedSnapshot: true,
          finalizedDocumentId: createdDoc.id,
        }),
      });
      expect(mockStorageService.getSignedUrl).toHaveBeenCalledWith(
        createdDoc.storagePath,
        3600,
      );
      expect(result).toEqual({
        documentId: createdDoc.id,
        pageId,
        status: DraftPageStatus.FINALIZED,
        pdfUrl: 'https://storage.afaq.com/signed-sop.pdf',
        downloadUrl: 'https://storage.afaq.com/signed-sop.pdf',
        message:
          'Draft compiled into PDF, stored in documents, and activated in candidate profile.',
      });
    });

    // [OMA-W002-T008] Given draft page not found or unauthorized, When finalize is called, Then it throws NotFoundException (IDOR check)
    it('should throw NotFoundException if draft page does not exist or user is unauthorized', async () => {
      // Arrange
      mockPrisma.draftPages.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.finalize('user-1', 'invalid-page', {}),
      ).rejects.toThrow(NotFoundException);
    });

    // [OMA-W002-T008] Given user reached max document limit, When finalize is called, Then it throws BadRequestException
    it('should throw BadRequestException if candidate has reached maximum document limit', async () => {
      // Arrange
      const draftPage = { id: 'page-1', userId: 'user-1', title: 'Doc' };
      mockPrisma.draftPages.findFirst.mockResolvedValue(draftPage);
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: 'user-1',
      });
      mockPrisma.documents.count.mockResolvedValue(20); // Limit is 20

      // Act & Assert
      await expect(service.finalize('user-1', 'page-1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    // [OMA-W002-T008] Given invalid documentTypeId, When finalize is called, Then it throws BadRequestException
    it('should throw BadRequestException if specified document type does not exist', async () => {
      // Arrange
      const draftPage = { id: 'page-1', userId: 'user-1', title: 'Doc' };
      mockPrisma.draftPages.findFirst.mockResolvedValue(draftPage);
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: 'user-1',
      });
      mockPrisma.documents.count.mockResolvedValue(0);
      mockPrisma.documentTypes.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.finalize('user-1', 'page-1', {
          documentTypeId: 'nonexistent-type',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // [OMA-W004-T002] Test finalize composite workflow response DTO
    it('should fall back to first active document type when documentTypeId is not provided', async () => {
      // Arrange
      const draftPage = {
        id: 'page-1',
        userId: 'user-1',
        title: 'Default Type Doc',
        contentJson: null,
      };
      mockPrisma.draftPages.findFirst.mockResolvedValue(draftPage);
      mockPrisma.userProfiles.findUnique.mockResolvedValue(null); // Profile does not exist yet
      mockPrisma.userProfiles.create.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.documents.count.mockResolvedValue(0);
      mockPrisma.documentTypes.findFirst.mockResolvedValue({
        id: 'type-default',
        name: 'General Document',
      });
      mockStorageService.upload.mockResolvedValue({
        key: 'documents/user-1/uuid.pdf',
      });
      mockPrisma.documents.create.mockResolvedValue({
        id: 'doc-auto',
        documentTypeId: 'type-default',
        displayName: 'Default Type Doc.pdf',
        storagePath: 'documents/user-1/uuid.pdf',
      });
      mockPrisma.draftPages.update.mockResolvedValue({
        ...draftPage,
        status: DraftPageStatus.FINALIZED,
      });

      // Act
      const result = await service.finalize('user-1', 'page-1', {});

      // Assert
      expect(mockPrisma.userProfiles.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
      expect(mockPrisma.documentTypes.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      expect(result.documentId).toBe('doc-auto');
      expect(result.status).toBe(DraftPageStatus.FINALIZED);
      expect(result.downloadUrl).toBe(
        'https://storage.afaq.com/signed-pdf-url',
      );
    });

    // [OMA-W002-T008] Given no documentTypeId and no active document types, When finalize is called, Then it throws BadRequestException
    it('should throw BadRequestException if no active document types exist in the system', async () => {
      // Arrange
      const draftPage = { id: 'page-1', userId: 'user-1', title: 'Doc' };
      mockPrisma.draftPages.findFirst.mockResolvedValue(draftPage);
      mockPrisma.userProfiles.findUnique.mockResolvedValue({
        userId: 'user-1',
      });
      mockPrisma.documents.count.mockResolvedValue(0);
      mockPrisma.documentTypes.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.finalize('user-1', 'page-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unlock', () => {
    // [OMA-W002-T008] Given locked finalized page, When unlock is called, Then it transitions back to IN_PROGRESS
    it('should unlock finalized draft page back to IN_PROGRESS state', async () => {
      // Arrange
      const userId = 'user-1';
      const pageId = 'page-1';
      const finalizedPage = {
        id: pageId,
        userId,
        status: DraftPageStatus.FINALIZED,
      };

      mockPrisma.draftPages.findFirst.mockResolvedValue(finalizedPage);
      mockPrisma.draftPages.update.mockResolvedValue({
        ...finalizedPage,
        status: DraftPageStatus.IN_PROGRESS,
      });

      // Act
      const result = await service.unlock(userId, pageId);

      // Assert
      expect(mockPrisma.draftPages.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: {
          status: DraftPageStatus.IN_PROGRESS,
        },
      });
      expect(result).toEqual({
        unlocked: true,
        status: DraftPageStatus.IN_PROGRESS,
      });
    });

    // [OMA-W002-T008] Given non-existent page, When unlock is called, Then it throws NotFoundException
    it('should throw NotFoundException on unlock if draft page is not found', async () => {
      // Arrange
      mockPrisma.draftPages.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.unlock('user-1', 'foreign-page')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
