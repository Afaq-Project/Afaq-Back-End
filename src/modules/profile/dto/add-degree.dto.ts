import { IsUUID } from 'class-validator';
export class AddDegreeDto {
  @IsUUID()
  educationLevelId: string;
}
