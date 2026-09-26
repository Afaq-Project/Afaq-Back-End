import { IsUUID, IsOptional, IsNotEmpty } from 'class-validator';

export class UploadDocumentDto {
  @IsNotEmpty()
  @IsUUID()
  documentTypeId: string;

  @IsOptional()
  file?: unknown;
}
