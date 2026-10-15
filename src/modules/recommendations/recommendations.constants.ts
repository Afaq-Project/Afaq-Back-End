import { Prisma } from '@prisma/ai-client';

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

export const MATCH_SORT_WHITELIST = [
  'score_desc',
  'score_asc',
  'calculated_at_desc',
] as const;

export const MATCH_SORT_TO_ORDER_BY: Record<
  (typeof MATCH_SORT_WHITELIST)[number],
  | Prisma.MatchScoreOrderByWithRelationInput
  | Prisma.MatchScoreOrderByWithRelationInput[]
> = {
  score_desc: [{ scorePct: 'desc' }, { opportunityId: 'asc' }],
  score_asc: [{ scorePct: 'asc' }, { opportunityId: 'asc' }],
  calculated_at_desc: [{ calculatedAt: 'desc' }, { opportunityId: 'asc' }],
};

export const INACTIVE_OPPORTUNITY_STATUSES = [
  'closed',
  'expired',
  'archived',
  'rejected',
];

export const CACHE_PREFIX_MATCHES = 'rec:matches';
export const CACHE_PREFIX_COMBINED = 'rec:combined';
