import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  picture?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isEmailVerified: boolean;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiPropertyOptional()
  lastLoginAt?: Date;
}
