// [OMA-W002-T006] AiTransformController
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiAssistantService } from '../ai-assistant.service';
import { AiEditDto } from '../dto/ai-edit.dto';
import { AiGenerateDto } from '../dto/ai-generate.dto';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('editor/ai')
export class AiTransformController {
  constructor(private readonly aiService: AiAssistantService) {}

  // [OMA-W004-T001] Explicit HTTP 200 OK for AI transform routes
  @HttpCode(HttpStatus.OK)
  @Post('edit')
  @ApiOperation({
    summary:
      'Transform selected text (rephrase, grammar check, tone adjustment)',
  })
  @ApiResponse({ status: 200, description: 'Transformed text result' })
  async transformText(@Body() dto: AiEditDto) {
    return this.aiService.transformText(dto);
  }

  // [OMA-W004-T001] Explicit HTTP 200 OK for AI transform routes
  @HttpCode(HttpStatus.OK)
  @Post('generate')
  @ApiOperation({ summary: 'Generate starter content based on a user prompt' })
  @ApiResponse({ status: 200, description: 'Generated content block' })
  async generateContent(@Body() dto: AiGenerateDto) {
    return this.aiService.generateContent(dto);
  }
}
