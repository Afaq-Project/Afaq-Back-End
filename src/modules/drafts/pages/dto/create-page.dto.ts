// [OMA-W002-T004] CreatePageDto
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePageDto {
  @ApiProperty({
    description: 'Document title',
    example: 'Statement of Purpose',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ description: 'Parent page ID for nested hierarchies' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Optional ID of source uploaded document',
  })
  @IsUUID()
  @IsOptional()
  documentId?: string;

  @ApiPropertyOptional({
    description: 'Initial TipTap ProseMirror content AST',
  })
  @IsOptional()
  contentJson?: Record<string, unknown>;
}
