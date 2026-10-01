export const OPPORTUNITY_FIELD_WHITELIST = [
  'id',
  'title',
  'organization',
  'country',
  'deadline',
  'opportunity_type',
  'is_remote',
  'description',
  'eligibility',
  'location',
  'funding_type',
  'application_url',
  'source_url',
  'study_levels',
  'fields_of_study',
  'source_id',
  'created_at',
  'updated_at',
] as const;

export const OPPORTUNITY_DEFAULT_FIELDS = [
  'id',
  'title',
  'organization',
  'country',
  'deadline',
  'opportunity_type',
  'is_remote',
] as const;

export const OPPORTUNITY_SORT_WHITELIST = [
  'created_at',
  'updated_at',
  'deadline',
  'title',
  'country',
  'opportunity_type',
] as const;
