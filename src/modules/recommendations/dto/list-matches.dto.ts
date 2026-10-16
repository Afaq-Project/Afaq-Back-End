import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ListOpportunitiesDto } from '../../opportunities/dto/list-opportunities.dto';

export class ListMatchesDto extends OmitType(ListOpportunitiesDto, [
  'page',
  'limit',
  'sort',
  'fields',
] as const) {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  // [OMA-W001-T001] (logic) min_score validation >= 1
  @Min(1)
  @Max(100)
  min_score?: number;

  @ApiPropertyOptional({
    description: 'One of: score_desc, score_asc, calculated_at_desc',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(score_desc|score_asc|calculated_at_desc)$/, {
    message: 'sort must be score_desc, score_asc, or calculated_at_desc',
  })
  sort?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 datetime' })
  @IsOptional()
  @IsDateString()
  calculated_after?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) {
      return true;
    }
    if (value === 'false' || value === false) {
      return false;
    }
    return value;
  })
  @IsBoolean()
  include_expired?: boolean;
}
