import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AllowExtraFields } from '../../../common/decorators/allow-extra-fields.decorator';

@AllowExtraFields()
export class GetCountriesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by region' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['nameEn', 'nameAr', 'isoCode'],
    default: 'nameEn',
  })
  @IsOptional()
  @IsIn(['nameEn', 'nameAr', 'isoCode'])
  sort?: 'nameEn' | 'nameAr' | 'isoCode';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
