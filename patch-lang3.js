const fs = require('fs');
let content = fs.readFileSync('src/modules/profile/services/languages.service.spec.ts', 'utf8');

// The line 93 `service.create` has `proficiency: 'Native', isNative: false` -> we should only have `proficiency: 'Native'` for CreateLanguageDto
content = content.replace(
  /service\.create\('userId', \{\n\s*languageId: 'langId',\n\s*proficiency: 'Native', isNative: false \}\)/g,
  "service.create('userId', {\n        languageId: 'langId',\n        proficiency: 'Native' })"
);

// The mockResolvedValue for userLanguages.create/findUnique should have `proficiencyLevelId: 'Native'` instead of `proficiency: 'Native'`
content = content.replace(
  /mockResolvedValue\(\{\n\s*userId: 'userId',\n\s*languageId: 'langId',\n\s*proficiency: 'Native', isNative: false \}\)/g,
  "mockResolvedValue({\n        userId: 'userId',\n        languageId: 'langId',\n        proficiencyLevelId: 'Native', isNative: false })"
);

fs.writeFileSync('src/modules/profile/services/languages.service.spec.ts', content);
