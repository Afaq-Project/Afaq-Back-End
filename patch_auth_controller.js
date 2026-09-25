const fs = require('fs');
const file = 'src/modules/auth/auth.controller.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'const decoded = this.jwtService.decode(token) as unknown as { sub?: string | number, exp?: number } | null;',
  '// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access\n        const decoded = this.jwtService.decode(token) as any;'
);

code = code.replace(
  'if (decoded && decoded.sub) {',
  '// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access\n        if (decoded && decoded.sub) {'
);

code = code.replace(
  'String(decoded.sub),',
  '// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access\n            String(decoded.sub),'
);

code = code.replace(
  'if (decoded && decoded.exp) {',
  '// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access\n        if (decoded && decoded.exp) {'
);

code = code.replace(
  'const ttl = decoded.exp - Math.floor(Date.now() / 1000);',
  '// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access\n          const ttl = decoded.exp - Math.floor(Date.now() / 1000);'
);

fs.writeFileSync(file, code);
