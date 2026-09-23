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
  MAX_EXPERIENCES: 'profile.max_experiences',
  MAX_DOCUMENT_SIZE_BYTES: 'documents.max_size_bytes',
  ALLOWED_DOCUMENT_MIME_TYPES: 'documents.allowed_mime_types',
} as const;

export type SystemSettingKey =
  (typeof SystemSettingKeys)[keyof typeof SystemSettingKeys];

export const SystemSettingDefaults: Record<SystemSettingKey, unknown> = {
  [SystemSettingKeys.MATCHING_THRESHOLD]: 60,
  [SystemSettingKeys.WEIGHT_PERSONAL_IDENTITY]: 18,
  [SystemSettingKeys.WEIGHT_LOCATION_ORIGIN]: 15,
  [SystemSettingKeys.WEIGHT_EDUCATION]: 35,
  [SystemSettingKeys.WEIGHT_LANGUAGES]: 10,
  [SystemSettingKeys.WEIGHT_TESTS]: 7,
  [SystemSettingKeys.WEIGHT_PREFERENCES_STATUSES]: 15,
  [SystemSettingKeys.MAX_EDUCATIONS]: 5,
  [SystemSettingKeys.MAX_LANGUAGES]: 10,
  [SystemSettingKeys.MAX_TEST_RESULTS]: 10,
  [SystemSettingKeys.MAX_TARGET_DEGREES]: 5,
  [SystemSettingKeys.MAX_TARGET_MAJORS]: 10,
  [SystemSettingKeys.MAX_TARGET_INSTITUTIONS]: 10,
  [SystemSettingKeys.MAX_BIO_LENGTH]: 1000,
  [SystemSettingKeys.MAX_EXPERIENCES]: 10,
  [SystemSettingKeys.MAX_DOCUMENT_SIZE_BYTES]: 10485760,
  [SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES]: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};
