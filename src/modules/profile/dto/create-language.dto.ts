import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLanguageDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Language ID from languagesMaster',
  })
  @IsUUID()
  @IsNotEmpty()
  languageId: string;

  @ApiProperty({ example: 'Native', description: 'Proficiency level' })
  @IsString()
  @IsNotEmpty()
  proficiency: string;
}
