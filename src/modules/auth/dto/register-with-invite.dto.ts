// [OMA-W002-T009] RegisterWithInviteDto
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterWithInviteDto {
  @ApiProperty({ description: 'Secure onboarding token' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'P@ssw0rd123',
    minLength: 8,
    description:
      'Password must be at least 8 characters long and contain at least one letter and one number',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message:
      'Password must be at least 8 characters long and contain at least one letter and one number',
  })
  password: string;

  @ApiProperty({ example: 'Fatima' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Al-Mansoor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;
}
