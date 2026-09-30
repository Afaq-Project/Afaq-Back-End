import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';
import { RedisService } from '../../../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey:
        configService.get<string>('security.JWT_SECRET') ||
        configService.get<string>('JWT_SECRET') ||
        'dev-only-secret-do-not-use-in-production!!',
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token) {
      const isBlacklisted = await this.redisService.client.exists(
        `bl_${token}`,
      );
      if (isBlacklisted === 1) {
        throw new UnauthorizedException('Token revoked');
      }
    }

    // Check token version against Redis for instant invalidation
    const currentVersionStr = await this.redisService.client.get(
      `tv:${payload.sub}`,
    );
    if (!currentVersionStr) {
      throw new UnauthorizedException('Token version missing or invalidated');
    }
    const currentVersion = parseInt(currentVersionStr, 10);

    // If payload has no tokenVersion, default to 1 for backward compatibility
    const payloadVersion = payload.tokenVersion || 1;

    if (payloadVersion < currentVersion) {
      throw new UnauthorizedException('Token version invalid');
    }

    // Stateless JWT validation to avoid DB hits on every request
    // Assumes token contains all necessary authorization info
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isActive: true, // Assuming active if token is valid
    };
  }
}
