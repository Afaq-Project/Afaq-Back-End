import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class GetCitiesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by country ID' })
  @IsOptional()
  @IsUUID()
  countryId?: string;
}
