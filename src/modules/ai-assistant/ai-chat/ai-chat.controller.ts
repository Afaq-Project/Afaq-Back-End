// [OMA-W002-T006] AiChatController
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
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
import { AiChatDto } from '../dto/ai-chat.dto';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('editor/ai')
export class AiChatController {
  constructor(private readonly aiService: AiAssistantService) {}

  // [OMA-W004-T001] Explicit HTTP 200 OK for AI chat route
  @HttpCode(HttpStatus.OK)
  @Post('chat')
  @ApiOperation({
    summary: 'Send a conversational message to the AI writing copilot',
  })
  @ApiResponse({
    status: 200,
    description: 'AI assistant response message with conversation ID',
  })
  async chat(@Req() req: RequestWithUser, @Body() dto: AiChatDto) {
    return this.aiService.chat(req.user.id, dto);
  }
}
