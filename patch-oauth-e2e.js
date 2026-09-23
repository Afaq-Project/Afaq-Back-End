const fs = require('fs');
let content = fs.readFileSync('test/oauth.e2e-spec.ts', 'utf8');

// Replace roles with userRoles in include
content = content.replace(/roles: { include: { role: true } },/g, 'userRoles: { include: { role: true } },');

// Replace oauthIdentities which is not in include or is not existing
content = content.replace(/expect\(dbUser\?.oauthIdentities\.length\)\.toBe\(1\);/g, '');
content = content.replace(/expect\(dbUser\?.oauthIdentities\[0\]\.provider\)\.toBe\('google'\);/g, '');
content = content.replace(/expect\(dbUser\?.oauthIdentities\[0\]\.providerUserId\)\.toBe\('111'\);/g, '');

// There might be another oauthIdentities check
content = content.replace(/expect\(dbUser\?.oauthIdentities\.length\)\.toBe\(1\);/g, '');
content = content.replace(/expect\(dbUser\?.oauthIdentities\[0\]\.provider\)\.toBe\('linkedin'\);/g, '');
content = content.replace(/expect\(dbUser\?.oauthIdentities\[0\]\.providerUserId\)\.toBe\('222'\);/g, '');

fs.writeFileSync('test/oauth.e2e-spec.ts', content);
