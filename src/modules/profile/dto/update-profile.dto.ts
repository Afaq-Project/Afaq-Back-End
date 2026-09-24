import {
  IsOptional,
  ValidateIf,
  IsString,
  IsEmail,
  IsISO8601,
  IsUUID,
  MaxLength,
  IsIn,
  IsUrl,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeString } from '../../../common/utils/sanitizer.util';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  firstName?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  @SanitizeString()
  lastName?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsISO8601()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    enum: ['MALE', 'FEMALE'],
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['MALE', 'FEMALE'])
  gender?: 'MALE' | 'FEMALE';

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  maritalStatusId?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(30)
  @SanitizeString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000, { context: { code: 'BIO_TOO_LONG' } })
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
  @MaxLength(500, { each: true })
  // SanitizeString handles arrays intrinsically (see sanitizer.util.ts)
  @SanitizeString()
  experiences?: string[];

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  countryOfResidenceId?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  nationalityId?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  currentCityId?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  educationLevelId?: string;
}
