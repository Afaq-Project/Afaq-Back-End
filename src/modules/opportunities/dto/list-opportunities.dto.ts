import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class ListOpportunitiesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Format: {field}:{asc|desc}' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(asc|desc)$/, {
    message: 'sort must be in format field:asc or field:desc',
  })
  sort?: string;

  @ApiPropertyOptional({ description: 'Comma-separated fields or *' })
  @IsOptional()
  @IsString()
  fields?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  opportunity_type?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  funding_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_remote?: boolean;

  @ApiPropertyOptional({ description: 'ISO 8601 datetime' })
  @IsOptional()
  @IsDateString()
  deadline_from?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 datetime' })
  @IsOptional()
  @IsDateString()
  deadline_to?: string;

  @ApiPropertyOptional({ description: 'UUID v4' })
  @IsOptional()
  @IsUUID('4')
  source_id?: string;

  @ApiPropertyOptional({ description: 'Comma-separated values' })
  @IsOptional()
  @IsString()
  study_levels?: string;

  @ApiPropertyOptional({ description: 'Comma-separated values' })
  @IsOptional()
  @IsString()
  fields_of_study?: string;
}
