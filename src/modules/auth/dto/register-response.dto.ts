import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({
    example:
      'Registration successful. Please check your email to verify your account.',
  })
  message: string;

  @ApiProperty({ type: 'null', required: false, nullable: true })
  data: null;
}
