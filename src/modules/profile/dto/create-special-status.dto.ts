import { IsUUID } from 'class-validator';

export class CreateSpecialStatusDto {
  @IsUUID()
  specialStatusId: string;
}
