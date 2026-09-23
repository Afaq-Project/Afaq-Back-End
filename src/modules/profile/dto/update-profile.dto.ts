import {
  IsOptional,
  IsString,
  IsEmail,
  IsISO8601,
  IsUUID,
  MaxLength,
  IsIn,
  IsUrl,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeString } from '../../../common/utils/sanitizer.util';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    enum: ['MALE', 'FEMALE'],
  })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE'])
  gender?: 'MALE' | 'FEMALE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  maritalStatusId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @SanitizeString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @SanitizeString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUrl()
  @SanitizeString()
  profilePhotoUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Free-text list of prior work or volunteer experience entries',
    example: ['Software Engineering Intern at Acme', 'Volunteer Tutor'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @MaxLength(500, { each: true })
  // SanitizeString handles arrays intrinsically (see sanitizer.util.ts)
  @SanitizeString()
  experiences?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  countryOfResidenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  nationalityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currentCityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  educationLevelId?: string;
}
