import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GpaScale } from '@prisma/client';

@ValidatorConstraint({ name: 'isAfterStartDate', async: false })
export class IsAfterStartDateConstraint implements ValidatorConstraintInterface {
  validate(endDate: string, args: ValidationArguments) {
    const object = args.object as Record<string, unknown>;
    if (!object.startDate || !endDate) {
      return true;
    }
    return new Date(endDate) >= new Date(object.startDate as string);
  }
  defaultMessage() {
    return 'endDate must be after or equal to startDate';
  }
}

export function IsAfterStartDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
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
  @IsAfterStartDate({ context: { code: 'INVALID_DATE_RANGE' } })
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
  @Min(0)
  gpaRaw?: number;

  @ApiPropertyOptional({ enum: GpaScale })
  @ValidateIf(
    (o: CreateEducationDto) => o.gpaRaw !== undefined && o.gpaRaw !== null,
  )
  @IsEnum(GpaScale)
  @IsNotEmpty({ context: { code: 'GPA_SCALE_REQUIRED' } })
  gpaScale?: GpaScale;
}
