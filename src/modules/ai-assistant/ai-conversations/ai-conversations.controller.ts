// [OMA-W009-T003] AiConversationsController
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiAssistantService } from '../ai-assistant.service';
import { ConversationMessagesResponseDto } from '../dto/conversation-messages-response.dto';
import { ConversationPaginationQueryDto } from '../dto/conversation-pagination-query.dto';
import { ConversationListResponseDto } from '../dto/conversation-summary.dto';

// [OMA-W009-T003]
@ApiTags('AI Assistant - Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('editor/ai/conversations')
export class AiConversationsController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  // [OMA-W009-T003]
  @Get()
  @ApiOperation({ summary: 'List user conversation sessions with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of user conversations',
    type: ConversationListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listConversations(
    @CurrentUser('id') userId: string,
    @Query() query: ConversationPaginationQueryDto,
  ) {
    return this.aiAssistantService.listConversations(userId, query);
  }

  // [OMA-W009-T003]
  @Get(':conversationId/messages')
  @ApiOperation({
    summary: 'Get chronological message history for a conversation',
  })
  @ApiParam({
    name: 'conversationId',
    type: 'string',
    format: 'uuid',
    description: 'Conversation session UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Message history for conversation',
    type: ConversationMessagesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found or access denied',
  })
  async getConversationMessages(
    @CurrentUser('id') userId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: ConversationPaginationQueryDto,
  ) {
    return this.aiAssistantService.getConversationMessages(
      userId,
      conversationId,
      query,
    );
  }
}
