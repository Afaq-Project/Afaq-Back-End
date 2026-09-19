import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard as NestAuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../../redis/redis.service';
import { ExtractJwt } from 'passport-jwt';
import { IS_PUBLIC_KEY } from '@common/decorators';

@Injectable()
export class JwtAuthGuard extends NestAuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      const isBlacklisted = await this.redis.client.get(`bl_${token}`);
      if (isBlacklisted) {
        throw new UnauthorizedException({
          message: 'Token has been revoked',
          code: 'AUTH_TOKEN_REVOKED',
        });
      }
    }

    return super.canActivate(context) as Promise<boolean> | boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info && info.name === 'TokenExpiredError') {
        throw (
          err ||
          new UnauthorizedException({
            message: 'Token expired',
            code: 'AUTH_TOKEN_EXPIRED',
          })
        );
      }
      if (info && info.name === 'JsonWebTokenError') {
        throw (
          err ||
          new UnauthorizedException({
            message: 'Invalid token',
            code: 'AUTH_TOKEN_INVALID',
          })
        );
      }
      throw (
        err ||
        new UnauthorizedException({
          message: 'Missing token',
          code: 'AUTH_TOKEN_MISSING',
        })
      );
    }
    return user;
  }
}
