import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEducationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  degree: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  major: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  institution: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  graduationYear?: number;
}
