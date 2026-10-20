// [OMA-W002-T006] AiChatDto
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AiChatDto {
  @ApiProperty({
    description: 'Candidate query or instruction to the writing copilot',
  })
  @IsString()
  @IsNotEmpty()
  // [OMA-W002-T008] Guard against unbounded input DoS
  @MaxLength(50000)
  message: string;

  @ApiPropertyOptional({
    description: 'Active conversation ID for multi-turn history',
  })
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Optional current draft text for contextual grounding',
  })
  @IsString()
  @IsOptional()
  // [OMA-W002-T008] Guard against unbounded context DoS
  @MaxLength(50000)
  pageContext?: string;
}
