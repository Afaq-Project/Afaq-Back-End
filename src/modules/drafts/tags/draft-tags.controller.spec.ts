/* eslint-disable @typescript-eslint/unbound-method */
// [OMA-W003-T003] DraftTagsController Spec
import { Test, TestingModule } from '@nestjs/testing';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DraftTagsController } from './draft-tags.controller';
import { DraftTagsService } from './draft-tags.service';
import { CreateTagDto } from './dto/create-tag.dto';

describe('DraftTagsController', () => {
  let controller: DraftTagsController;
  let mockTagsService: {
    listTags: jest.Mock;
    createTag: jest.Mock;
    deleteTag: jest.Mock;
    assignTagToPage: jest.Mock;
    removeTagFromPage: jest.Mock;
  };

  const mockUser = { id: 'user-123' };
  const mockReq = { user: mockUser };
  const mockSlug = 'research-space';
  const mockPageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockTagId = 't1b2c3d4-e5f6-7890-abcd-ef1234567890';

  beforeEach(async () => {
    mockTagsService = {
      listTags: jest.fn(),
      createTag: jest.fn(),
      deleteTag: jest.fn(),
      assignTagToPage: jest.fn(),
      removeTagFromPage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DraftTagsController],
      providers: [
        {
          provide: DraftTagsService,
          useValue: mockTagsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DraftTagsController>(DraftTagsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should delegate list to service and return tags', async () => {
      const expectedTags = [
        { id: mockTagId, name: 'Important', color: '#ff0000' },
      ];
      mockTagsService.listTags.mockResolvedValue(expectedTags);

      const result = await controller.list(mockReq, mockSlug);

      expect(mockTagsService.listTags).toHaveBeenCalledWith(
        mockUser.id,
        mockSlug,
      );
      expect(result).toEqual(expectedTags);
    });
  });

  describe('create', () => {
    it('should delegate create to service and return created tag', async () => {
      const dto: CreateTagDto = { name: 'Urgent', color: '#ff5500' };
      const expectedTag = { id: mockTagId, ...dto };
      mockTagsService.createTag.mockResolvedValue(expectedTag);

      const result = await controller.create(mockReq, mockSlug, dto);

      expect(mockTagsService.createTag).toHaveBeenCalledWith(
        mockUser.id,
        mockSlug,
        dto,
      );
      expect(result).toEqual(expectedTag);
    });
  });

  describe('delete', () => {
    it('should delegate delete to service and return confirmation', async () => {
      const expectedResult = { success: true };
      mockTagsService.deleteTag.mockResolvedValue(expectedResult);

      const result = await controller.delete(mockReq, mockSlug, mockTagId);

      expect(mockTagsService.deleteTag).toHaveBeenCalledWith(
        mockUser.id,
        mockSlug,
        mockTagId,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('assignToPage', () => {
    // [OMA-W003-T003] Test assignToPage HTTP 200 OK status code metadata
    it('should have HTTP 200 OK metadata configured on assignToPage endpoint', () => {
      const httpCode = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        DraftTagsController.prototype.assignToPage,
      );
      expect(httpCode).toBe(HttpStatus.OK);
      expect(httpCode).toBe(200);

      const httpCodeDirect = Reflect.getMetadata(
        '__httpCode__',
        DraftTagsController.prototype.assignToPage,
      );
      expect(httpCodeDirect).toBe(200);
    });

    // [OMA-W003-T003] Test assignToPage HTTP 200 OK status code metadata
    it('should delegate assignToPage to service and return assigned tag association', async () => {
      const expectedResult = {
        pageId: mockPageId,
        tagId: mockTagId,
      };
      mockTagsService.assignTagToPage.mockResolvedValue(expectedResult);

      const result = await controller.assignToPage(
        mockReq,
        mockSlug,
        mockPageId,
        mockTagId,
      );

      expect(mockTagsService.assignTagToPage).toHaveBeenCalledWith(
        mockUser.id,
        mockSlug,
        mockPageId,
        mockTagId,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('removeFromPage', () => {
    it('should delegate removeTagFromPage to service and return confirmation', async () => {
      const expectedResult = { success: true };
      mockTagsService.removeTagFromPage.mockResolvedValue(expectedResult);

      const result = await controller.removeFromPage(
        mockReq,
        mockSlug,
        mockPageId,
        mockTagId,
      );

      expect(mockTagsService.removeTagFromPage).toHaveBeenCalledWith(
        mockUser.id,
        mockSlug,
        mockPageId,
        mockTagId,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
