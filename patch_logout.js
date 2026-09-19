const fs = require('fs');
const file = 'src/modules/auth/auth.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const decoded = this.authService.decodeToken(token);',
  'const decoded = this.jwtService.decode(token) as any;'
);

content = content.replace(
  'private readonly redisService: RedisService,',
  'private readonly redisService: RedisService,\n    private readonly jwtService: import("@nestjs/jwt").JwtService,'
);

fs.writeFileSync(file, content);
