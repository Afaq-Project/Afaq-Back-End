/* eslint-disable @typescript-eslint/unbound-method */
// [OMA-W004-T001] AiTransformController Spec
import { Test, TestingModule } from '@nestjs/testing';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiTransformController } from './ai-transform.controller';
import { AiAssistantService } from '../ai-assistant.service';
import { AiEditMode } from '../dto/ai-edit.dto';

describe('AiTransformController', () => {
  let controller: AiTransformController;
  let mockAiService: {
    transformText: jest.Mock;
    generateContent: jest.Mock;
  };

  beforeEach(async () => {
    mockAiService = {
      transformText: jest.fn(),
      generateContent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiTransformController],
      providers: [
        {
          provide: AiAssistantService,
          useValue: mockAiService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AiTransformController>(AiTransformController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('transformText', () => {
    // [OMA-W004-T001] Test AI controller HTTP 200 OK status metadata
    it('should have HTTP 200 OK metadata configured on edit endpoint', () => {
      const httpCode = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        AiTransformController.prototype.transformText,
      );
      expect(httpCode).toBe(HttpStatus.OK);
      expect(httpCode).toBe(200);

      const httpCodeDirect = Reflect.getMetadata(
        '__httpCode__',
        AiTransformController.prototype.transformText,
      );
      expect(httpCodeDirect).toBe(200);
    });

    // [OMA-W004-T001] Test AI controller HTTP 200 OK status metadata
    it('should delegate transformText to service and return result', async () => {
      const dto = {
        text: 'Draft statement',
        mode: AiEditMode.ACADEMIC_TONE,
      };
      const expectedResult = {
        originalText: dto.text,
        transformedText: 'Polished statement',
        mode: AiEditMode.ACADEMIC_TONE,
      };
      mockAiService.transformText.mockResolvedValue(expectedResult);

      const result = await controller.transformText(dto);

      expect(mockAiService.transformText).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('generateContent', () => {
    // [OMA-W004-T001] Test AI controller HTTP 200 OK status metadata
    it('should have HTTP 200 OK metadata configured on generate endpoint', () => {
      const httpCode = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        AiTransformController.prototype.generateContent,
      );
      expect(httpCode).toBe(HttpStatus.OK);
      expect(httpCode).toBe(200);

      const httpCodeDirect = Reflect.getMetadata(
        '__httpCode__',
        AiTransformController.prototype.generateContent,
      );
      expect(httpCodeDirect).toBe(200);
    });

    // [OMA-W004-T001] Test AI controller HTTP 200 OK status metadata
    it('should delegate generateContent to service and return result', async () => {
      const dto = {
        prompt: 'Draft an outline',
        context: 'Scholarship',
      };
      const expectedResult = {
        content: 'Drafted outline content',
        format: 'markdown',
      };
      mockAiService.generateContent.mockResolvedValue(expectedResult);

      const result = await controller.generateContent(dto);

      expect(mockAiService.generateContent).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });
});
