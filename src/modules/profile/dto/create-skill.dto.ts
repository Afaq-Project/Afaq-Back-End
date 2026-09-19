import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateSkillDto {
  @ApiProperty({ description: 'The UUID of the skill from SkillsMaster' })
  @IsUUID()
  @IsNotEmpty()
  skillId: string;

  @ApiProperty({
    description: 'Proficiency level from 1 to 5',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  proficiency: number;
}
