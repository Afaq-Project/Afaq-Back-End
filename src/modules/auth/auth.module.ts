import { Module, forwardRef } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '@/prisma';
import { UsersModule } from '@/modules/users/users.module';
import { ProfileModule } from '../profile/profile.module';
import {
  UsersRepository,
  UserRolesRepository,
} from '@/modules/users/repositories';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OAuthGuard } from './guards/oauth.guard';
import { CsrfOriginGuard } from './guards/csrf-origin.guard';
import {
  EncryptionService,
  OauthIdentityService,
  OAuthProcessorService,
  OAuthService,
} from './services';
import { getStrategyClass } from './config/strategy.registry';
import { getAllSupportedProviders } from './config/providers.config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('security.JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'security.JWT_ACCESS_EXPIRES',
            '15m',
          ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    forwardRef(() => UsersModule),
    ProfileModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    UsersRepository,
    UserRolesRepository,
    OAuthService,
    OAuthGuard,
    CsrfOriginGuard,
    EncryptionService,
    OauthIdentityService,
    OAuthProcessorService,
    ...getAllSupportedProviders()
      .map((provider) => getStrategyClass(provider))
      .filter(
        (strategy): strategy is NonNullable<typeof strategy> => !!strategy,
      ),
  ],
  exports: [AuthService, JwtAuthGuard, OAuthService],
})
export class AuthModule {}
