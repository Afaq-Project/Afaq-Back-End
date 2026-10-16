import { Prisma, CleanedOpportunity } from '@prisma/ai-client';

/**
 * 7 fields used for the brief opportunity representation.
 */
export const BRIEF_OPPORTUNITY_SELECT = {
  id: true,
  title: true,
  organization: true,
  deadline: true,
  country: true,
  opportunityType: true,
  isRemote: true,
} satisfies Prisma.CleanedOpportunitySelect;

/**
 * Maps a CleanedOpportunity containing at least the brief fields
 * to a snake_case BriefOpportunityDto shape.
 */
export function toBriefOpportunity(opportunity: Partial<CleanedOpportunity>) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization,
    deadline: opportunity.deadline,
    country: opportunity.country,
    opportunity_type: opportunity.opportunityType,
    is_remote: opportunity.isRemote,
  };
}
