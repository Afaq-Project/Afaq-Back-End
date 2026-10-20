// [OMA-W002-T005] CreateTagDto
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ description: 'Tag name', example: 'Urgent' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Hex or Tailwind color name',
    example: '#EF4444',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;
}
