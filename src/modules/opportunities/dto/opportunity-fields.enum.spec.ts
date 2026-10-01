import {
  OPPORTUNITY_FIELD_WHITELIST,
  OPPORTUNITY_DEFAULT_FIELDS,
  OPPORTUNITY_SORT_WHITELIST,
} from './opportunity-fields.enum';

describe('Opportunity Fields Constants', () => {
  describe('OPPORTUNITY_FIELD_WHITELIST', () => {
    it('should have length of 18', () => {
      expect(OPPORTUNITY_FIELD_WHITELIST).toHaveLength(18);
    });

    it('should contain specific field names', () => {
      const expectedFields = [
        'id',
        'title',
        'organization',
        'location',
        'deadline',
      ];
      expectedFields.forEach((field) => {
        expect(OPPORTUNITY_FIELD_WHITELIST).toContain(field);
      });
    });
  });

  describe('OPPORTUNITY_DEFAULT_FIELDS', () => {
    it('should have length of 7', () => {
      expect(OPPORTUNITY_DEFAULT_FIELDS).toHaveLength(7);
    });

    it('should contain specific field names', () => {
      const expectedFields = [
        'id',
        'title',
        'organization',
        'country',
        'deadline',
      ];
      expectedFields.forEach((field) => {
        expect(OPPORTUNITY_DEFAULT_FIELDS).toContain(field);
      });
    });

    it('should have all elements present in OPPORTUNITY_FIELD_WHITELIST', () => {
      OPPORTUNITY_DEFAULT_FIELDS.forEach((field) => {
        expect(OPPORTUNITY_FIELD_WHITELIST).toContain(field);
      });
    });
  });

  describe('OPPORTUNITY_SORT_WHITELIST', () => {
    it('should have length of 6', () => {
      expect(OPPORTUNITY_SORT_WHITELIST).toHaveLength(6);
    });

    it('should contain specific field names', () => {
      const expectedFields = [
        'created_at',
        'updated_at',
        'deadline',
        'title',
        'country',
      ];
      expectedFields.forEach((field) => {
        expect(OPPORTUNITY_SORT_WHITELIST).toContain(field);
      });
    });
  });
});
