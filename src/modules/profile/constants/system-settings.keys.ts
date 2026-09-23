export const SystemSettingKeys = {
  MATCHING_THRESHOLD: 'matching.threshold',
  WEIGHT_PERSONAL_IDENTITY: 'profile.weight_personal_identity',
  WEIGHT_LOCATION_ORIGIN: 'profile.weight_location_origin',
  WEIGHT_EDUCATION: 'profile.weight_education',
  WEIGHT_LANGUAGES: 'profile.weight_languages',
  WEIGHT_TESTS: 'profile.weight_tests',
  WEIGHT_PREFERENCES_STATUSES: 'profile.weight_preferences_statuses',
  MAX_EDUCATIONS: 'profile.max_educations',
  MAX_LANGUAGES: 'profile.max_languages',
  MAX_TEST_RESULTS: 'profile.max_test_results',
  MAX_TARGET_DEGREES: 'profile.max_target_degrees',
  MAX_TARGET_MAJORS: 'profile.max_target_majors',
  MAX_TARGET_INSTITUTIONS: 'profile.max_target_institutions',
  MAX_BIO_LENGTH: 'profile.max_bio_length',
  MAX_SIZE_BYTES: 'documents.max_size_bytes',
  ALLOWED_MIME_TYPES: 'documents.allowed_mime_types',
} as const;

export type SystemSettingKey =
  (typeof SystemSettingKeys)[keyof typeof SystemSettingKeys];
