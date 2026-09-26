import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTestResultDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  testId: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  score: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  testDate?: string;
}
