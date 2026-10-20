// [OMA-W002-T008] DraftFinalizeDto
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class DraftFinalizeDto {
  @ApiPropertyOptional({
    description: 'Target Afaq document type UUID (e.g. CV, Personal Statement)',
    example: '5d47cc7c-5264-4bfb-94d2-fdafa83e6b70',
  })
  @IsUUID()
  @IsOptional()
  documentTypeId?: string;

  @ApiPropertyOptional({
    description: 'Display filename for the finalized document',
    example: 'Chevening_Personal_Statement.pdf',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  displayName?: string;
}
