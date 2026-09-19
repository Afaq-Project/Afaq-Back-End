import re

with open('src/modules/auth/auth.service.ts', 'r') as f:
    content = f.read()

new_refresh = """  async refreshToken(dto: RefreshTokenDto | string) {
    const token = typeof dto === 'string' ? dto : dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException({
        message: 'Refresh token is required',
        code: 'AUTH_REFRESH_TOKEN_MISSING',
      });
    }

    const isBlacklisted = await this.redisService.client.get(`bl_${token}`);
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
  }"""

start_idx = content.find('  async refreshToken(dto: RefreshTokenDto | string) {')
end_idx = content.find('  // Alias for backward compatibility', start_idx)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_refresh + '\n\n' + content[end_idx:]

with open('src/modules/auth/auth.service.ts', 'w') as f:
    f.write(content)

