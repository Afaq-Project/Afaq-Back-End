import { IsUUID } from 'class-validator';
export class AddInstitutionDto {
  @IsUUID()
  institutionId: string;
}
