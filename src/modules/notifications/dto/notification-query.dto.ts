// [OMA-W002-T003] NotificationQueryDto
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class NotificationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Page number' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Items per page',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Filter unread notifications only',
    default: false,
  })
  @IsOptional()
  @Transform(
    ({ value }) =>
      value === 'true' || value === true || value === 1 || value === '1',
  )
  @IsBoolean()
  unreadOnly?: boolean = false;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
