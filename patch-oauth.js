const fs = require('fs');
let content = fs.readFileSync('src/modules/auth/services/oauth-processor.service.spec.ts', 'utf8');

// Line 193 had `const result = ` removed! Let's put it back for the one that does not throw.
content = content.replace(
  /await service\.processOAuthLogin\(\{\n\s*provider: 'google',/g,
  "const result = await service.processOAuthLogin({\n        provider: 'google',"
);
// But wait, there are multiple processOAuthLogin. Let's just fix it by reading the file and replacing line 193.
