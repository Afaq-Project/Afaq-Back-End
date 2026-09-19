const fs = require('fs');
const file = 'src/modules/auth/auth.service.ts';
let content = fs.readFileSync(file, 'utf8');

// Add crypto import
if (!content.includes("import * as crypto from 'crypto';")) {
  content = "import * as crypto from 'crypto';\n" + content;
}

// Add the helpers to the class
const classStart = content.indexOf('export class AuthService {');
const helpers = `
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const hash = this.hashToken(token);
    const key = \`rt:\${userId}:\${hash}\`;
    const setKey = \`rt:user:\${userId}\`;
    const pipeline = this.redisService.client.pipeline();
    pipeline.set(key, '1', 'EX', 7 * 24 * 60 * 60); // 7 days
    pipeline.sadd(setKey, hash);
    pipeline.expire(setKey, 7 * 24 * 60 * 60);
    await pipeline.exec();
  }

  async revokeRefreshToken(userId: string, token: string): Promise<void> {
    const hash = this.hashToken(token);
    const key = \`rt:\${userId}:\${hash}\`;
    const setKey = \`rt:user:\${userId}\`;
    const pipeline = this.redisService.client.pipeline();
    pipeline.del(key);
    pipeline.srem(setKey, hash);
    await pipeline.exec();
  }

  async isRefreshTokenActive(userId: string, token: string): Promise<boolean> {
    const hash = this.hashToken(token);
    const key = \`rt:\${userId}:\${hash}\`;
    const exists = await this.redisService.client.exists(key);
    return exists === 1;
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    const setKey = \`rt:user:\${userId}\`;
    const hashes = await this.redisService.client.smembers(setKey);
    const pipeline = this.redisService.client.pipeline();
    for (const hash of hashes) {
      pipeline.del(\`rt:\${userId}:\${hash}\`);
    }
    pipeline.del(setKey);
    await pipeline.exec();
  }
`;

content = content.replace('export class AuthService {', 'export class AuthService {' + helpers);

// Update login
const loginTokensStr = `const tokens = await this.generateTokens(
      updatedUser.id,
      updatedUser.email,
      role,
    );`;
const storeTokenStr = `await this.storeRefreshToken(updatedUser.id, tokens.refreshToken);`;

content = content.replace(loginTokensStr, loginTokensStr + '\n    ' + storeTokenStr);

// Overhaul refreshToken
const refreshTokenStart = content.indexOf('async refreshToken(dto: RefreshTokenDto | string) {');
const endOfRefresh = content.indexOf('  // ── Password Reset', refreshTokenStart);

const newRefreshToken = `async refreshToken(dto: RefreshTokenDto | string) {
    const token = typeof dto === 'string' ? dto : dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException({
        message: 'Refresh token is required',
        code: 'AUTH_REFRESH_TOKEN_MISSING',
      });
    }

    const isBlacklisted = await this.redisService.client.get(\`bl_\${token}\`);
    if (isBlacklisted) {
      throw new UnauthorizedException({
        message: 'Refresh token revoked',
        code: 'AUTH_REFRESH_TOKEN_REVOKED',
      });
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException({
        message: 'Refresh token invalid or expired',
        code: 'AUTH_REFRESH_TOKEN_INVALID',
      });
    }

    const isActive = await this.isRefreshTokenActive(payload.sub, token);
    if (!isActive) {
      throw new UnauthorizedException({
        message: 'Refresh token revoked',
        code: 'AUTH_REFRESH_TOKEN_REVOKED',
      });
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const role = await this.userRolesRepo.getCurrentRoleName(user.id);
    const tokens = await this.generateTokens(user.id, user.email, role);

    await this.revokeRefreshToken(user.id, token);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
`;

content = content.substring(0, refreshTokenStart) + newRefreshToken + '\n' + content.substring(endOfRefresh);

fs.writeFileSync(file, content);
console.log("Patched auth.service.ts");
