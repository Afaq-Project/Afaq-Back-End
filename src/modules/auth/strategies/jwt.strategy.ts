import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('security.JWT_SECRET') ||
        configService.get<string>('JWT_SECRET') ||
        'dev-only-secret-do-not-use-in-production!!',
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async validate(payload: JwtPayload) {
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
