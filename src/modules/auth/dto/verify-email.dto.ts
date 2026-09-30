import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'The verification token sent via email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
