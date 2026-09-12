import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateLanguageDto {
  @ApiProperty()
  @IsString()
  languageId: string;

  @ApiProperty()
  @IsString()
  proficiency: string;
}
