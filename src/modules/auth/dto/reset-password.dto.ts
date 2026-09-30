import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'MatchPasswords', async: false })
export class MatchPasswordsConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints as string[];
    const relatedValue = (args.object as Record<string, unknown>)[
      relatedPropertyName
    ];
    return confirmPassword === relatedValue;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'AUTH_PASSWORDS_DO_NOT_MATCH';
  }
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The raw password reset token from the email link',
    example: 'abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'The new password (min 8 chars, >=1 letter, >=1 digit)',
    example: 'NewSecure456',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'AUTH_PASSWORD_TOO_WEAK' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'AUTH_PASSWORD_TOO_WEAK',
  })
  password: string;

  @ApiProperty({
    description: 'Confirm the new password',
    example: 'NewSecure456',
  })
  @IsString()
  @IsNotEmpty()
  @Validate(MatchPasswordsConstraint, ['password'], {
    context: { code: 'AUTH_PASSWORDS_DO_NOT_MATCH' },
  })
  confirmPassword: string;
}
