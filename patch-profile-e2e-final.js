const fs = require('fs');
let content = fs.readFileSync('test/profile.e2e-spec.ts', 'utf8');

// For the boundary test where we expect 200 but don't use res
content = content.replace(
  /const res = await request\(app\.getHttpServer\(\)\)\n\s*\.patch\('\/api\/v1\/profile'\)\n\s*\.set\('Authorization', `Bearer \$\{userToken\}`\)\n\s*\.send\(\{ bio: 'a'\.repeat\(1000\) \}\)\n\s*\.expect\(200\);/g,
  "await request(app.getHttpServer())\n        .patch('/api/v1/profile')\n        .set('Authorization', `Bearer ${userToken}`)\n        .send({ bio: 'a'.repeat(1000) })\n        .expect(200);"
);

// For the overLimit boundary test where we expect 400 but don't use res
content = content.replace(
  /const res = await request\(app\.getHttpServer\(\)\)\n\s*\.patch\('\/api\/v1\/profile'\)\n\s*\.set\('Authorization', `Bearer \$\{userToken\}`\)\n\s*\.send\(\{ bio: overLimit \}\)\n\s*\.expect\(400\);/g,
  "await request(app.getHttpServer())\n        .patch('/api/v1/profile')\n        .set('Authorization', `Bearer ${userToken}`)\n        .send({ bio: overLimit })\n        .expect(400);"
);

// For /auth/register and /auth/login where res is used but we have reg1 / reg2 ?
// Wait, profile.e2e-spec.ts has register and login.
content = content.replace(
  /const res = await request\(app\.getHttpServer\(\)\)\n\s*\.post\('\/api\/v1\/auth\/register'\)\n\s*\.send/g,
  "const reg = await request(app.getHttpServer())\n      .post('/api/v1/auth/register')\n      .send"
);

content = content.replace(
  /const res = await request\(app\.getHttpServer\(\)\)\n\s*\.post\('\/api\/v1\/auth\/login'\)\n\s*\.send/g,
  "const loginRes = await request(app.getHttpServer())\n      .post('/api/v1/auth/login')\n      .send"
);

// Remove unused ones in reference
content = content.replace(
  /const res = await request\(app\.getHttpServer\(\)\)\.get\('\/api\/v1\/reference\/(.*?)\'\)\.expect\(200\);\n\s*const res = await request/g,
  "await request(app.getHttpServer()).get('/api/v1/reference/$1').expect(200);\n      await request"
);
content = content.replace(
  /const res = await request\(app\.getHttpServer\(\)\)\.get\('\/api\/v1\/reference\/countries'\)\.expect\(200\);\n\s*await request/g,
  "await request(app.getHttpServer()).get('/api/v1/reference/countries').expect(200);\n      await request"
);
content = content.replace(
  /const res = await request\(app\.getHttpServer\(\)\)\.get\('\/api\/v1\/reference\/cities'\)\.expect\(200\);/g,
  "await request(app.getHttpServer()).get('/api/v1/reference/cities').expect(200);"
);
content = content.replace(
  /const res = await request\(app\.getHttpServer\(\)\)\.get\('\/api\/v1\/reference\/marital-statuses'\)\.expect\(200\);/g,
  "await request(app.getHttpServer()).get('/api/v1/reference/marital-statuses').expect(200);"
);
content = content.replace(
  /const res = await request\(app\.getHttpServer\(\)\)\.get\('\/api\/v1\/reference\/languages'\)\.expect\(200\);/g,
  "await request(app.getHttpServer()).get('/api/v1/reference/languages').expect(200);"
);

fs.writeFileSync('test/profile.e2e-spec.ts', content);
