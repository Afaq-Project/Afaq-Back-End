import { IsNotEmpty, IsUUID, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLanguageDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Language ID from languagesMaster',
  })
  @IsUUID()
  @IsNotEmpty()
  languageId: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Proficiency level ID from ProficiencyLevels',
  })
  @IsUUID()
  @IsNotEmpty()
  proficiencyLevelId: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Is this the native language?',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isNative?: boolean;
}
