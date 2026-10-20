// [OMA-W002-T005] CreateTemplateDto
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({
    description: 'Template title',
    example: 'Chevening Leadership Essay Template',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'TipTap ProseMirror template structure' })
  @IsObject()
  @IsNotEmpty()
  contentJson: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Template category', default: 'General' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string = 'General';

  @ApiPropertyOptional({ description: 'Icon name or emoji' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Is default system template',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean = false;

  @ApiPropertyOptional({
    description: 'Optional workspace ID to scope template',
  })
  @IsUUID()
  @IsOptional()
  spaceId?: string;
}
