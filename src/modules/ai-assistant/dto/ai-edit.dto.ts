// [OMA-W002-T006] AiEditDto
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum AiEditMode {
  REPHRASE = 'rephrase',
  GRAMMAR = 'grammar',
  SHORTEN = 'shorten',
  EXPAND = 'expand',
  SUMMARIZE = 'summarize',
  ACADEMIC_TONE = 'academic_tone',
}

export class AiEditDto {
  @ApiProperty({ description: 'The highlighted text snippet to transform' })
  @IsString()
  @IsNotEmpty()
  // [OMA-W002-T008] Guard against unbounded text input DoS
  @MaxLength(50000)
  text: string;

  @ApiProperty({ enum: AiEditMode, description: 'Transformation operation' })
  @IsEnum(AiEditMode)
  @IsNotEmpty()
  mode: AiEditMode;

  @ApiPropertyOptional({ description: 'Optional custom instructions' })
  @IsString()
  @IsOptional()
  // [OMA-W002-T008] Guard against unbounded instructions DoS
  @MaxLength(50000)
  instructions?: string;
}
