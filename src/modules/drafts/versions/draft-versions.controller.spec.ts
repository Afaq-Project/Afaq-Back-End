/* eslint-disable @typescript-eslint/unbound-method */
// [OMA-W003-T003] DraftVersionsController Spec
import { Test, TestingModule } from '@nestjs/testing';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DraftVersionsController } from './draft-versions.controller';
import { DraftVersionsService } from './draft-versions.service';

describe('DraftVersionsController', () => {
  let controller: DraftVersionsController;
  let mockVersionsService: {
    listVersions: jest.Mock;
    revertToVersion: jest.Mock;
  };

  const mockUser = { id: 'user-123' };
  const mockReq = { user: mockUser };
  const mockPageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockVersionId = 'v1b2c3d4-e5f6-7890-abcd-ef1234567890';

  beforeEach(async () => {
    mockVersionsService = {
      listVersions: jest.fn(),
      revertToVersion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DraftVersionsController],
      providers: [
        {
          provide: DraftVersionsService,
          useValue: mockVersionsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DraftVersionsController>(DraftVersionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listVersions', () => {
    it('should delegate listVersions to service and return history list', async () => {
      const mockTimeline = [
        {
          id: mockVersionId,
          pageId: mockPageId,
          userId: mockUser.id,
          createdAt: new Date(),
        },
      ];
      mockVersionsService.listVersions.mockResolvedValue(mockTimeline);

      const result = await controller.listVersions(mockReq, mockPageId);

      expect(mockVersionsService.listVersions).toHaveBeenCalledWith(
        mockUser.id,
        mockPageId,
      );
      expect(result).toEqual(mockTimeline);
    });
  });

  describe('revert', () => {
    // [OMA-W003-T003] Test revert HTTP 200 OK status code metadata
    it('should have HTTP 200 OK metadata configured on revert endpoint', () => {
      const httpCode = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        DraftVersionsController.prototype.revert,
      );
      expect(httpCode).toBe(HttpStatus.OK);
      expect(httpCode).toBe(200);

      const httpCodeDirect = Reflect.getMetadata(
        '__httpCode__',
        DraftVersionsController.prototype.revert,
      );
      expect(httpCodeDirect).toBe(200);
    });

    // [OMA-W003-T003] Test revert HTTP 200 OK status code metadata
    it('should delegate revert to service and return active content restored to snapshot', async () => {
      const expectedResult = {
        id: mockPageId,
        title: 'Restored Title',
        contentJson: { type: 'doc', content: [] },
        versionNumber: 2,
      };
      mockVersionsService.revertToVersion.mockResolvedValue(expectedResult);

      const result = await controller.revert(
        mockReq,
        mockPageId,
        mockVersionId,
      );

      expect(mockVersionsService.revertToVersion).toHaveBeenCalledWith(
        mockUser.id,
        mockPageId,
        mockVersionId,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
