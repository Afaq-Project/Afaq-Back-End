import { toMatchDto } from './recommendations.mapper';
import { toBriefOpportunity } from '../opportunities/opportunity-brief.mapper';

jest.mock('../opportunities/opportunity-brief.mapper', () => ({
  toBriefOpportunity: jest.fn(),
}));

describe('recommendations.mapper', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('toMatchDto', () => {
    it('returns exactly 5 keys when no opportunity is provided', () => {
      const match = {
        opportunityId: 'opp-1',
        scorePct: 85.5,
        scoreBreakdown: { skillMatch: 90 },
        calculationVersion: '1.0',
        calculatedAt: new Date('2023-01-01T00:00:00.000Z'),
        userId: 'user-1',
        someOtherField: 'ignored',
      };

      const result = toMatchDto(match as any);

      expect(Object.keys(result)).toHaveLength(5);
      expect(result).toEqual({
        opportunity_id: 'opp-1',
        score_pct: 85.5,
        score_breakdown: { skillMatch: 90 },
        calculation_version: '1.0',
        calculated_at: new Date('2023-01-01T00:00:00.000Z'),
      });
    });

    it('reuses toBriefOpportunity when opportunity is provided', () => {
      const mockBrief = { id: 'opp-1', title: 'Test Opp' };
      (toBriefOpportunity as jest.Mock).mockReturnValue(mockBrief);

      const match = {
        opportunityId: 'opp-1',
        scorePct: 85.5,
        scoreBreakdown: { skillMatch: 90 },
        calculationVersion: '1.0',
        calculatedAt: new Date('2023-01-01T00:00:00.000Z'),
        opportunity: {
          id: 'opp-1',
          title: 'Test Opp',
        },
      };

      const result = toMatchDto(match as any);

      expect(toBriefOpportunity).toHaveBeenCalledWith(match.opportunity);
      expect(result).toHaveProperty('opportunity', mockBrief);
      expect(Object.keys(result)).toHaveLength(6);
    });

    it('preserves nulls if breakdown is null', () => {
      const match = {
        opportunityId: 'opp-1',
        scorePct: 85.5,
        scoreBreakdown: null,
        calculationVersion: '1.0',
        calculatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };

      const result = toMatchDto(match as any);

      expect(result.score_breakdown).toBeNull();
    });
  });
});
