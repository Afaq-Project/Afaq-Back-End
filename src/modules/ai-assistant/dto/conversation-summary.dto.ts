// [OMA-W009-T001]
import { ApiProperty } from '@nestjs/swagger';

// [OMA-W009-T001]
export class PaginationMetaDto {
  @ApiProperty({ description: 'Total number of items' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}

// [OMA-W009-T001]
export class ConversationSummaryDto {
  @ApiProperty({ description: 'Unique identifier of the conversation' })
  id: string;

  @ApiProperty({
    description: 'Conversation title or topic summary',
    nullable: true,
  })
  title: string | null;

  @ApiProperty({ description: 'Total messages in the conversation' })
  messageCount: number;

  @ApiProperty({
    description: 'Preview snippet of the last message',
    nullable: true,
  })
  lastMessagePreview: string | null;

  @ApiProperty({ description: 'Timestamp when the conversation was created' })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the conversation was last updated',
  })
  updatedAt: Date;
}

// [OMA-W009-T001]
export class ConversationListResponseDto {
  @ApiProperty({
    type: [ConversationSummaryDto],
    description: 'List of conversation summaries',
  })
  items: ConversationSummaryDto[];

  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Pagination metadata',
  })
  meta: PaginationMetaDto;
}
