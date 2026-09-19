const fs = require('fs');
const file = 'src/modules/auth/guards/jwt-auth.guard.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import { Reflector } from '@nestjs/core';", "import { Reflector } from '@nestjs/core';\nimport { RedisService } from '../../../redis/redis.service';\nimport { ExtractJwt } from 'passport-jwt';");

content = content.replace(
  "constructor(private readonly reflector: Reflector) {",
  "constructor(private readonly reflector: Reflector, private readonly redis: RedisService) {"
);

content = content.replace(
  "canActivate(context: ExecutionContext) {",
  `async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    
    const request = context.switchToHttp().getRequest();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
    if (token) {
      const isBlacklisted = await this.redis.client.get(\`bl_\${token}\`);
      if (isBlacklisted) {
        throw new UnauthorizedException({ message: 'Token has been revoked', code: 'AUTH_TOKEN_REVOKED' });
      }
    }
`
);

content = content.replace("return super.canActivate(context);", "return super.canActivate(context) as Promise<boolean> | boolean;");

fs.writeFileSync(file, content);
