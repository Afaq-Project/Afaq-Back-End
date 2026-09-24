import os

create_dto = """import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsNumber,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GpaScale } from '@prisma/client';
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface, registerDecorator, ValidationOptions } from 'class-validator';

@ValidatorConstraint({ name: 'isAfterStartDate', async: false })
export class IsAfterStartDateConstraint implements ValidatorConstraintInterface {
  validate(endDate: string, args: ValidationArguments) {
    const object = args.object as Record<string, unknown>;
    if (!object.startDate || !endDate) return true;
    return new Date(endDate) > new Date(object.startDate as string);
  }
  defaultMessage() {
    return 'endDate must be after startDate';
  }
}

export function IsAfterStartDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAfterStartDateConstraint,
    });
  };
}

export class CreateEducationDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  educationLevelId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  institutionId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  majorId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  minorMajorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @IsAfterStartDate()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedGraduationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpaRaw?: number;

  @ApiPropertyOptional({ enum: GpaScale })
  @ValidateIf((o) => o.gpaRaw !== undefined && o.gpaRaw !== null)
  @IsEnum(GpaScale)
  @IsNotEmpty()
  gpaScale?: GpaScale;
}
"""

update_dto = """import { PartialType } from '@nestjs/swagger';
import { CreateEducationDto } from './create-education.dto';

export class UpdateEducationDto extends PartialType(CreateEducationDto) {}
"""

with open('src/modules/profile/dto/create-education.dto.ts', 'w') as f:
    f.write(create_dto)

with open('src/modules/profile/dto/update-education.dto.ts', 'w') as f:
    f.write(update_dto)

