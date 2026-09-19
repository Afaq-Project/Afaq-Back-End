import {
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
  IsDate,
  Length,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeString } from '../../../common/utils/sanitizer.util';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @SanitizeString()
  educationLevel?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  @SanitizeString()
  fieldOfStudy?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  currentCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  currentCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  experienceLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasFinancialNeed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @SanitizeString()
  @Length(0, 500)
  careerGoals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  profilePhotoUrl?: string;
}
