import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AllowExtraFields } from '../../../common/decorators/allow-extra-fields.decorator';

@AllowExtraFields()
export class GetMajorsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['nameEn', 'nameAr'],
    default: 'nameEn',
  })
  @IsOptional()
  @IsIn(['nameEn', 'nameAr'])
  sort?: 'nameEn' | 'nameAr';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
