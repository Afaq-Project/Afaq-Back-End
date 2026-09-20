import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OAuthService } from './services/oauth.service';
import { OAuthGuard } from './guards/oauth.guard';
import { OAuthProcessorService } from './services/oauth-processor.service';
import { PrismaService } from '@/prisma';
import { UsersService } from '@/modules/users/users.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { LinkedInStrategy } from './strategies/linkedin.strategy';

// Mock the strategies to avoid constructor errors if they are instantiated
jest.mock('./strategies/google.strategy');
jest.mock('./strategies/linkedin.strategy');
jest.mock('./config/providers.config', () => ({
  getAllSupportedProviders: jest.fn().mockReturnValue(['google', 'linkedin']),
}));

describe('AuthModule Boot Testing', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        PassportModule,
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(UsersService)
      .useValue({})
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn().mockImplementation((key: string) => {
          if (
            key === 'oauth.OAUTH_ENCRYPTION_KEY' ||
            key === 'OAUTH_ENCRYPTION_KEY' ||
            key === 'storage.encryption.key'
          ) {
            return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
          }
          return undefined;
        }),
      })
      .compile();
  });

  it('Module compiles successfully', () => {
    expect(module).toBeDefined();

    // Core services should still be present
    expect(module.get<AuthService>(AuthService)).toBeDefined();
    expect(module.get<JwtStrategy>(JwtStrategy)).toBeDefined();

    // Strategies should be instantiated
    expect(module.get(GoogleStrategy)).toBeDefined();
    expect(module.get(LinkedInStrategy)).toBeDefined();
  });

  it('should provide OAuth services regardless of configured strategies', () => {
    expect(module.get<OAuthService>(OAuthService)).toBeDefined();
    expect(module.get<OAuthGuard>(OAuthGuard)).toBeDefined();
    expect(
      module.get<OAuthProcessorService>(OAuthProcessorService),
    ).toBeDefined();
  });
});
