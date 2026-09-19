const fs = require('fs');
const file = 'src/modules/auth/auth.controller.ts';
let content = fs.readFileSync(file, 'utf8');

const logoutStart = content.indexOf('  @Post(\'logout\')');
const logoutEnd = content.indexOf('  // ── Password Reset', logoutStart); // Let's find end of logout

let logoutMethod = `  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (clear cookies)' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token) {
      try {
        const decoded = this.jwtService.decode(token);
        if (decoded && decoded.sub) {
          await this.authService.revokeAllUserRefreshTokens(decoded.sub);
        }
        if (decoded && decoded.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await this.redisService.client.set(
              \`bl_\${token}\`,
              'revoked',
              'EX',
              ttl,
            );
          }
        }
      } catch {
        /* ignore */
      }
    }
    this.clearTokenCookies(res);
  }
`;

// replace everything from logoutStart up to the line before next method or EOF
let newContent = content.substring(0, logoutStart) + logoutMethod + '\n' + content.substring(content.indexOf('  // ── Password Reset', logoutStart));

fs.writeFileSync(file, newContent);
console.log("Patched auth.controller.ts");
