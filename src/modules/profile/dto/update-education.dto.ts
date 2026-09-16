import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateEducationDto } from './create-education.dto';
import { ValidateIf, IsIn, IsNumber } from 'class-validator';

export class UpdateEducationDto extends PartialType(CreateEducationDto) {
  @ApiPropertyOptional()
  @ValidateIf((o: UpdateEducationDto) => o.gpaScale !== undefined)
  @IsNumber()
  gpaValue?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateEducationDto) => o.gpaValue !== undefined)
  @IsIn(['4.0', 'percentage', 'letter'])
  gpaScale?: '4.0' | 'percentage' | 'letter';
}
