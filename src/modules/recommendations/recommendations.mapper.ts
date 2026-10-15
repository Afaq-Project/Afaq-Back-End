import { MatchScore, CleanedOpportunity } from '@prisma/ai-client';
import { MatchDto, MatchWithOpportunityDto } from './dto/match-response.dto';
import { toBriefOpportunity } from '../opportunities/opportunity-brief.mapper';

type MatchWithOptionalOpp = MatchScore & {
  opportunity?: Partial<CleanedOpportunity>;
};

export function toMatchDto(
  match: MatchWithOptionalOpp,
): MatchDto | MatchWithOpportunityDto {
  const base: MatchDto = {
    opportunity_id: match.opportunityId,
    score_pct: match.scorePct,
    score_breakdown: match.scoreBreakdown as Record<string, unknown>,
    calculation_version: match.calculationVersion,
    calculated_at: match.calculatedAt,
  };

  if (match.opportunity) {
    return {
      ...base,
      opportunity: toBriefOpportunity(
        match.opportunity,
      ) as unknown as MatchWithOpportunityDto['opportunity'], // Cast properly without using any
    };
  }

  return base;
}
