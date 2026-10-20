// [OMA-W002-T004] UpdateSpaceDto
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSpaceDto {
  @ApiPropertyOptional({ description: 'Display name of the draft workspace' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Optional workspace description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Lucide icon identifier or emoji' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;
}
