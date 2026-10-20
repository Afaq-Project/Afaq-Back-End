// [OMA-W002-T004] UpdatePageDto
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DraftPageStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdatePageDto {
  @ApiPropertyOptional({ description: 'Document title' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ description: 'TipTap ProseMirror document AST' })
  @IsOptional()
  contentJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: DraftPageStatus,
    description: 'Document status lifecycle',
  })
  @IsEnum(DraftPageStatus)
  @IsOptional()
  status?: DraftPageStatus;

  @ApiPropertyOptional({ description: 'Sibling ordering position' })
  @IsInt()
  @IsOptional()
  position?: number;

  @ApiPropertyOptional({ description: 'Move to a different parent page' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
