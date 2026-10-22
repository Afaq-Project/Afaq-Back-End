// [OMA-W002-T006] AiGenerateDto
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AiGenerateDto {
  @ApiProperty({
    description: 'Prompt describing what to draft',
    example:
      'Draft an introductory paragraph describing leadership in community projects for a scholarship essay.',
  })
  @IsString()
  @IsNotEmpty()
  // [OMA-W002-T008] Guard against unbounded prompt input DoS
  @MaxLength(50000)
  prompt: string;

  @ApiPropertyOptional({ description: 'Optional document context' })
  @IsString()
  @IsOptional()
  // [OMA-W002-T008] Guard against unbounded context input DoS
  @MaxLength(50000)
  context?: string;
}
