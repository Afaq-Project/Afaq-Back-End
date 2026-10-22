// [OMA-W002-T009] InviteUserDto
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class InviteUserDto {
  @ApiProperty({
    example: 'candidate@university.edu',
    description: 'Target email for invitation',
  })
  @IsEmail({}, { message: 'Invalid email address format' })
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 1, description: 'Optional assigned role ID' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  roleId?: number;

  @ApiPropertyOptional({
    example: 7,
    default: 7,
    description: 'Days until token expiration',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  expiresInDays?: number = 7;
}
