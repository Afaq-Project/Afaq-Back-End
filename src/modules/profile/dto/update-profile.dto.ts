import {
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
  IsDateString,
  Length,
  ArrayMaxSize,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  fieldOfStudy?: string[];

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

  @ApiPropertyOptional({ type: [SkillDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SkillDto)
  skills?: SkillDto[];

  @ApiPropertyOptional({ type: [LanguageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => LanguageDto)
  languages?: LanguageDto[];
}
