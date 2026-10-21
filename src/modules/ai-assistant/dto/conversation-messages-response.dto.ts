// [OMA-W009-T001]
import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './conversation-summary.dto';

// [OMA-W009-T001]
export class ConversationMessageItemDto {
  @ApiProperty({ description: 'Message unique identifier' })
  id: string;

  @ApiProperty({
    description: 'Role of the message sender (e.g., user, assistant, system)',
  })
  role: string;

  @ApiProperty({ description: 'Message content' })
  content: string;

  @ApiProperty({ description: 'Timestamp when the message was sent' })
  createdAt: Date;
}

// [OMA-W009-T001]
export class ConversationMessagesResponseDto {
  @ApiProperty({ description: 'Unique identifier of the conversation' })
  conversationId: string;

  @ApiProperty({
    description: 'Conversation title',
    nullable: true,
  })
  title: string | null;

  @ApiProperty({
    type: [ConversationMessageItemDto],
    description: 'List of messages in the conversation',
  })
  messages: ConversationMessageItemDto[];

  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Pagination metadata',
  })
  meta: PaginationMetaDto;
}
