import { IsUUID } from 'class-validator';
export class AddMajorDto {
  @IsUUID()
  majorId: string;
}
