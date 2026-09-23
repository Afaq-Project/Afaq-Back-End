const fs = require('fs');
let content = fs.readFileSync('src/modules/profile/services/languages.service.spec.ts', 'utf8');

// Fix profileService assignment type
content = content.replace(
  'profileService = module.get<ProfileService>(ProfileService);',
  'profileService = module.get<ProfileService>(ProfileService) as unknown as ProfileServiceWithRecalculate;'
);

// Fix DTO properties
content = content.replace(/proficiencyLevelId: 'Native'/g, "proficiency: 'Native'");

// Fix mockResolvedValue for findUnique languagesMaster
content = content.replace(
  /{ id: 'langId', nameEn: 'English' }/g,
  "{ id: 'langId', nameEn: 'English', nameAr: 'English', isoCode: 'en', isActive: true, sortOrder: 1 }"
);

// Fix mockResolvedValue for userLanguages
content = content.replace(
  /proficiency: 'Native',\s*\}\);/g,
  "proficiencyLevelId: 'Native', isNative: false });"
);

fs.writeFileSync('src/modules/profile/services/languages.service.spec.ts', content);
