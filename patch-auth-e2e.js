const fs = require('fs');
let content = fs.readFileSync('test/auth.e2e-spec.ts', 'utf8');

// The JWT inspection code was added to register test (lines 52-60). Let's just remove it from register and add it to login.
content = content.replace(
  /\/\/ \[FR-006\] Inspect JWT payload\n\s*const token = res\.body\.data\.accessToken;\n\s*const payloadBase64 = token\.split\('\.'\)\[1\];\n\s*const payload = JSON\.parse\(Buffer\.from\(payloadBase64, 'base64'\)\.toString\('ascii'\)\);\n\s*expect\(payload\)\.toBeDefined\(\);\n\s*expect\(payload\.userProfile\)\.toBeUndefined\(\);\n\s*expect\(payload\.completionPct\)\.toBeUndefined\(\);/g,
  ''
);

// Add it to login test
content = content.replace(
  /expect\(res\.body\.data\.accessToken\)\.toBeDefined\(\);/g,
  `expect(res.body.data.accessToken).toBeDefined();

      const token = res.body.data.accessToken;
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('ascii'));
      expect(payload).toBeDefined();
      expect(payload.userProfile).toBeUndefined();
      expect(payload.completionPct).toBeUndefined();`
);

fs.writeFileSync('test/auth.e2e-spec.ts', content);
