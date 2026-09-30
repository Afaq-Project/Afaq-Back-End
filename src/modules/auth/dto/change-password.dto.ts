import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  Validate,
} from 'class-validator';
import { MatchPasswordsConstraint } from './reset-password.dto';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'The current password',
    example: 'OldSecure123',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

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
  newPassword: string;

  @ApiProperty({
    description: 'Confirm the new password',
    example: 'NewSecure456',
  })
  @IsString()
  @IsNotEmpty()
  @Validate(MatchPasswordsConstraint, ['newPassword'], {
    context: { code: 'AUTH_PASSWORDS_DO_NOT_MATCH' },
  })
  confirmNewPassword: string;
}
