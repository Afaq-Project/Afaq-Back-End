const fs = require('fs');
let content = fs.readFileSync('test/profile.e2e-spec.ts', 'utf8');

// Put back `const res = await` where `res.body` is used
content = content.replace(
  /await request\(app\.getHttpServer\(\)\)\n\s*\.get\('\/api\/v1\/profile'\)\n\s*\.set\('Authorization', `Bearer \$\{userToken\}`\);/g,
  "const res = await request(app.getHttpServer())\n        .get('/api/v1/profile')\n        .set('Authorization', `Bearer ${userToken}`);"
);

content = content.replace(
  /await request\(app\.getHttpServer\(\)\)\.get\('\/api\/v1\/reference\/countries'\)\.expect\(200\);/g,
  "const res = await request(app.getHttpServer()).get('/api/v1/reference/countries').expect(200);"
);

content = content.replace(
  /await request\(app\.getHttpServer\(\)\)\.get\('\/api\/v1\/reference\/education-levels'\)\.expect\(200\);/g,
  "const res = await request(app.getHttpServer()).get('/api/v1/reference/education-levels').expect(200);"
);

// We had multiple occurrences of `/api/v1/reference/education-levels` and `/api/v1/reference/countries` (in line 165/166 and 173/178).
// It's safer to just rewrite the file.
