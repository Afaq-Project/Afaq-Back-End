// [OMA-W002-T003] CreateNotificationDto
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateNotificationDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  typeCode: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;
}
