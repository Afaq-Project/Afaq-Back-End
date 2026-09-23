const fs = require('fs');
let content = fs.readFileSync('test/profile.e2e-spec.ts', 'utf8');

// Replace all const res = with res =
content = content.replace(/const res = await/g, 'res = await');
// Add let res; inside the describe blocks or simply replace `res = await` with `const resX = await`
// Actually, it's easier to just use a unique variable for each use.

fs.writeFileSync('test/profile.e2e-spec.ts', content);
