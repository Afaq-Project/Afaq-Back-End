// [OMA-W003-T001] DraftAttachmentsController Spec
jest.mock('uuid', () => ({ v4: () => '00000000-0000-0000-0000-000000000000' }));
import { Test, TestingModule } from '@nestjs/testing';
import { ParseFilePipe, FileTypeValidator } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DraftAttachmentsController } from './draft-attachments.controller';
import { DraftAttachmentsService } from './draft-attachments.service';

describe('DraftAttachmentsController', () => {
  let controller: DraftAttachmentsController;
  let mockAttachmentsService: {
    upload: jest.Mock;
    getDownloadUrl: jest.Mock;
    delete: jest.Mock;
  };

  const mockUser = { id: 'user-123' };
  const mockReq = { user: mockUser };
  const mockSlug = 'research-space';
  const mockPageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockAttachmentId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  beforeEach(async () => {
    mockAttachmentsService = {
      upload: jest.fn(),
      getDownloadUrl: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DraftAttachmentsController],
      providers: [
        {
          provide: DraftAttachmentsService,
          useValue: mockAttachmentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DraftAttachmentsController>(
      DraftAttachmentsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    // [OMA-W003-T001] Test file upload fallbackToMimetype for text and SVG files
    it('should process and delegate text/plain attachment upload to service', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'notes.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('Plain text notes content'),
        destination: '',
        filename: 'notes.txt',
        path: '',
        stream: null as any,
      };

      const expectedResponse = {
        id: mockAttachmentId,
        fileName: 'notes.txt',
        fileType: 'text/plain',
        fileSize: 1024,
        url: 'https://storage.example.com/attachments/notes.txt',
      };

      mockAttachmentsService.upload.mockResolvedValue(expectedResponse);

      const result = await controller.upload(
        mockReq,
        mockSlug,
        mockPageId,
        mockFile,
      );

      expect(mockAttachmentsService.upload).toHaveBeenCalledWith(
        mockUser.id,
        mockSlug,
        mockPageId,
        mockFile,
      );
      expect(result).toEqual(expectedResponse);
    });

    // [OMA-W003-T001] Test file upload fallbackToMimetype for text and SVG files
    it('should process and delegate text/markdown attachment upload to service', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'readme.md',
        encoding: '7bit',
        mimetype: 'text/markdown',
        size: 2048,
        buffer: Buffer.from('# Markdown Title\nContent'),
        destination: '',
        filename: 'readme.md',
        path: '',
        stream: null as any,
      };

      const expectedResponse = {
        id: mockAttachmentId,
        fileName: 'readme.md',
        fileType: 'text/markdown',
        fileSize: 2048,
        url: 'https://storage.example.com/attachments/readme.md',
      };

      mockAttachmentsService.upload.mockResolvedValue(expectedResponse);

      const result = await controller.upload(
        mockReq,
        mockSlug,
        mockPageId,
        mockFile,
      );

      expect(mockAttachmentsService.upload).toHaveBeenCalledWith(
        mockUser.id,
        mockSlug,
        mockPageId,
        mockFile,
      );
      expect(result).toEqual(expectedResponse);
    });

    // [OMA-W003-T001] Test file upload fallbackToMimetype for text and SVG files
    it('should process and delegate image/svg+xml attachment upload to service', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'vector.svg',
        encoding: '7bit',
        mimetype: 'image/svg+xml',
        size: 512,
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>',
        ),
        destination: '',
        filename: 'vector.svg',
        path: '',
        stream: null as any,
      };

      const expectedResponse = {
        id: mockAttachmentId,
        fileName: 'vector.svg',
        fileType: 'image/svg+xml',
        fileSize: 512,
        url: 'https://storage.example.com/attachments/vector.svg',
      };

      mockAttachmentsService.upload.mockResolvedValue(expectedResponse);

      const result = await controller.upload(
        mockReq,
        mockSlug,
        mockPageId,
        mockFile,
      );

      expect(mockAttachmentsService.upload).toHaveBeenCalledWith(
        mockUser.id,
        mockSlug,
        mockPageId,
        mockFile,
      );
      expect(result).toEqual(expectedResponse);
    });

    // [OMA-W003-T001] Test file upload fallbackToMimetype for text and SVG files
    it('should configure FileTypeValidator with fallbackToMimetype: true accepting text/plain, text/markdown, and image/svg+xml', async () => {
      const metadata = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        DraftAttachmentsController,
        'upload',
      );
      expect(metadata).toBeDefined();

      const routeArgKeys = Object.keys(metadata);
      let parseFilePipe: ParseFilePipe | undefined;

      for (const key of routeArgKeys) {
        const arg = metadata[key];
        if (arg.pipes && Array.isArray(arg.pipes)) {
          parseFilePipe = arg.pipes.find(
            (p: any) =>
              p instanceof ParseFilePipe ||
              p.constructor?.name === 'ParseFilePipe',
          );
          if (parseFilePipe) {
            break;
          }
        }
      }

      expect(parseFilePipe).toBeDefined();
      const validators = (parseFilePipe as any).validators;
      const fileTypeValidator = validators.find(
        (v: any) =>
          v instanceof FileTypeValidator ||
          v.constructor?.name === 'FileTypeValidator',
      );
      expect(fileTypeValidator).toBeDefined();
      expect(fileTypeValidator.validationOptions.fallbackToMimetype).toBe(true);

      const plainTextFile = {
        mimetype: 'text/plain',
        buffer: Buffer.from('hello plain text'),
      };
      const markdownFile = {
        mimetype: 'text/markdown',
        buffer: Buffer.from('# header'),
      };
      const svgFile = {
        mimetype: 'image/svg+xml',
        buffer: Buffer.from('<svg></svg>'),
      };

      await expect(fileTypeValidator.isValid(plainTextFile)).resolves.toBe(
        true,
      );
      await expect(fileTypeValidator.isValid(markdownFile)).resolves.toBe(true);
      await expect(fileTypeValidator.isValid(svgFile)).resolves.toBe(true);
    });
  });

  describe('getDownloadUrl', () => {
    it('should delegate getDownloadUrl to service', async () => {
      const expectedUrl = {
        url: 'https://storage.example.com/signed-url',
        expiresIn: 3600,
      };
      mockAttachmentsService.getDownloadUrl.mockResolvedValue(expectedUrl);

      const result = await controller.getDownloadUrl(mockReq, mockAttachmentId);

      expect(mockAttachmentsService.getDownloadUrl).toHaveBeenCalledWith(
        mockUser.id,
        mockAttachmentId,
      );
      expect(result).toEqual(expectedUrl);
    });
  });

  describe('delete', () => {
    it('should delegate delete to service', async () => {
      const expectedResponse = { success: true };
      mockAttachmentsService.delete.mockResolvedValue(expectedResponse);

      const result = await controller.delete(mockReq, mockAttachmentId);

      expect(mockAttachmentsService.delete).toHaveBeenCalledWith(
        mockUser.id,
        mockAttachmentId,
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});
