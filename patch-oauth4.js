const fs = require('fs');
let content = fs.readFileSync('src/modules/auth/services/oauth-processor.service.spec.ts', 'utf8');

// roles -> role
content = content.replace(/roles: true,/g, 'role: true,');

// fullName Jane Doe
content = content.replace(/userProfile: {\n\s*update: {\n\s*fullName: 'Jane Doe',\n\s*},\n\s*},/g, '');

// create profile properties
content = content.replace(/fullName: 'Alice Smith',\n\s*isDraft: true,\n\s*profilePhotoUrl: 'https:\/\/photo\.url',/g, 'isMatchable: false,');

fs.writeFileSync('src/modules/auth/services/oauth-processor.service.spec.ts', content);
