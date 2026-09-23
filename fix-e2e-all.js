const fs = require('fs');

// Fix profile.e2e-spec.ts
let p = fs.readFileSync('test/profile.e2e-spec.ts', 'utf8');
p = p.replace(/const res = const res =/g, 'const res =');
p = p.replace(/const login1 = const loginRes =/g, 'const loginRes =');
p = p.replace(/const res = await request\(app\.getHttpServer\(\)\)\n\s*\.patch\('\/api\/v1\/profile\/personal'\)/g, "await request(app.getHttpServer())\n        .patch('/api/v1/profile/personal')");
// Remove const res = for all reference routes except countries and education levels where it's used
p = p.replace(/const res = await request\(app\.getHttpServer\(\)\)\.get\('\/api\/v1\/reference\/countries\?search=InvalidCountryNameSearch99'\)\.expect\(200\);/g, "await request(app.getHttpServer()).get('/api/v1/reference/countries?search=InvalidCountryNameSearch99').expect(200);");
p = p.replace(/const res = await request\(app\.getHttpServer\(\)\)\.get\('\/api\/v1\/reference\/(.*?)\'\)\.expect\(200\);\n\s*const res = await request/g, "await request(app.getHttpServer()).get('/api/v1/reference/$1').expect(200);\n      await request");
fs.writeFileSync('test/profile.e2e-spec.ts', p);

// Fix oauth.e2e-spec.ts
let o = fs.readFileSync('test/oauth.e2e-spec.ts', 'utf8');
o = o.replace(/isDraft: false,/g, 'isMatchable: false,');
fs.writeFileSync('test/oauth.e2e-spec.ts', o);
