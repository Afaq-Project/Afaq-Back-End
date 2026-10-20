// [OMA-W002-T004] CreateSpaceDto
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSpaceDto {
  @ApiProperty({
    description: 'Display name of the draft workspace',
    example: 'Chevening Application 2026',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Optional workspace description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Lucide icon identifier or emoji',
    example: 'folder-git-2',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;
}
