import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateSkillDto {
  @ApiProperty()
  @IsString()
  skillId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(5)
  proficiency: number;
}
