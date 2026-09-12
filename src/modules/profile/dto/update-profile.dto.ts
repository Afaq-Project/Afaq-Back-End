import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  Length,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SkillDto {
  @ApiPropertyOptional()
  @IsString()
  skillId: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  proficiency: number;
}

export class LanguageDto {
  @ApiPropertyOptional()
  @IsString()
  languageId: string;

  @ApiPropertyOptional()
  @IsString()
  proficiency: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  educationLevel?: string;

  @IsOptional()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  experienceLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasFinancialNeed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  careerGoals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsOptional()
  @ApiPropertyOptional()
  @IsOptional()
  gpaValue?: number | string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gpaScale?: '4.0' | 'percentage' | 'letter';
}
