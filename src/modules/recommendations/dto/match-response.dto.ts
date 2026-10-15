import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BriefOpportunityDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  organization?: string | null;

  @ApiPropertyOptional()
  deadline?: Date | null;

  @ApiPropertyOptional()
  country?: string | null;

  @ApiPropertyOptional()
  opportunity_type?: string | null;

  @ApiPropertyOptional()
  is_remote?: boolean | null;
}

export class MatchDto {
  @ApiProperty()
  opportunity_id!: string;

  @ApiProperty()
  score_pct!: number;

  @ApiProperty()
  score_breakdown!: Record<string, unknown>;

  @ApiProperty()
  calculation_version!: number;

  @ApiProperty()
  calculated_at!: Date;
}

export class MatchWithOpportunityDto extends MatchDto {
  @ApiProperty({ type: () => BriefOpportunityDto })
  opportunity!: BriefOpportunityDto;
}

export class MatchesMeta {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  pages!: number;

  @ApiProperty()
  synced_at!: Date;
}

export class MatchListResponseDto {
  @ApiProperty({ type: () => [MatchDto] })
  data!: MatchDto[];

  @ApiProperty({ type: () => MatchesMeta })
  meta!: MatchesMeta;
}

export class MatchWithOpportunityListResponseDto {
  @ApiProperty({ type: () => [MatchWithOpportunityDto] })
  data!: MatchWithOpportunityDto[];

  @ApiProperty({ type: () => MatchesMeta })
  meta!: MatchesMeta;
}
