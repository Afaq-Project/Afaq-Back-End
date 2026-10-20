/* eslint-disable @typescript-eslint/unbound-method */
// [OMA-W003-T003] DraftExportController Spec
jest.mock('uuid', () => ({ v4: () => '00000000-0000-0000-0000-000000000000' }));
import { Test, TestingModule } from '@nestjs/testing';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DraftExportController } from './draft-export.controller';
import { DraftExportService } from './draft-export.service';
import { DraftFinalizeDto } from './dto/draft-finalize.dto';

describe('DraftExportController', () => {
  let controller: DraftExportController;
  let mockExportService: {
    finalize: jest.Mock;
    unlock: jest.Mock;
  };

  const mockUser = { id: 'user-123' };
  const mockReq = { user: mockUser };
  const mockPageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  beforeEach(async () => {
    mockExportService = {
      finalize: jest.fn(),
      unlock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DraftExportController],
      providers: [
        {
          provide: DraftExportService,
          useValue: mockExportService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DraftExportController>(DraftExportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('finalize', () => {
    it('should delegate finalize to service and return result', async () => {
      const dto: DraftFinalizeDto = {
        displayName: 'Finalized Document.pdf',
        documentTypeId: '5d47cc7c-5264-4bfb-94d2-fdafa83e6b70',
      };
      const expectedResult = {
        pageId: mockPageId,
        documentId: 'doc-uuid-123',
        pdfUrl: 'https://storage.example.com/docs/finalized.pdf',
      };
      mockExportService.finalize.mockResolvedValue(expectedResult);

      const result = await controller.finalize(mockReq, mockPageId, dto);

      expect(mockExportService.finalize).toHaveBeenCalledWith(
        mockUser.id,
        mockPageId,
        dto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('unlock', () => {
    // [OMA-W003-T003] Test unlock HTTP 200 OK status code metadata
    it('should have HTTP 200 OK metadata configured on unlock endpoint', () => {
      const httpCode = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        DraftExportController.prototype.unlock,
      );
      expect(httpCode).toBe(HttpStatus.OK);
      expect(httpCode).toBe(200);

      const httpCodeDirect = Reflect.getMetadata(
        '__httpCode__',
        DraftExportController.prototype.unlock,
      );
      expect(httpCodeDirect).toBe(200);
    });

    // [OMA-W003-T003] Test unlock HTTP 200 OK status code metadata
    it('should delegate unlock to service and return draft unlocked in IN_PROGRESS state', async () => {
      const expectedResult = {
        id: mockPageId,
        status: 'IN_PROGRESS',
        message: 'Draft unlocked successfully',
      };
      mockExportService.unlock.mockResolvedValue(expectedResult);

      const result = await controller.unlock(mockReq, mockPageId);

      expect(mockExportService.unlock).toHaveBeenCalledWith(
        mockUser.id,
        mockPageId,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
