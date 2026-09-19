import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule, CacheManagerOptions } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
import { CacheableMemory } from 'cacheable';
import { randomUUID } from 'crypto';
import {
  appConfig,
  databaseConfig,
  logConfig,
  redisConfig,
  securityConfig,
  uploadConfig,
  oauthConfig,
  storageConfig,
} from '@config/index';
import { PrismaModule } from '@/prisma';
import { RedisThrottlerStorage } from "./common/throttler/redis-throttler.storage";
import { RedisService } from "./redis/redis.service";
import { RedisModule } from '@/redis';
import { HealthModule } from '@modules/health';
import { UsersModule } from '@modules/users';
import { AuthModule } from '@modules/auth';
import { AuthGuard, RolesGuard, IdempotencyGuard } from '@common/guards';
import { RequestIdMiddleware, IdempotencyMiddleware } from '@common/middleware';
import { ProfileModule } from './modules/profile/profile.module';

@Module({
  imports: [
    // ── Configuration ────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        logConfig,
        redisConfig,
        securityConfig,
        uploadConfig,
        oauthConfig,
        storageConfig,
      ],
      envFilePath: ['.env.local', '.env'],
    }),

    // ── Structured Logging (Pino) ────────────────
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('app.NODE_ENV', 'development');
        const appName = config.get<string>('app.APP_NAME', 'ai-hub');
        const logDir = config.get<string>('log.LOG_DIR', './logs');
        const logMaxSize = config.get<string>('log.LOG_MAX_SIZE', '10m');
        const logFrequency = config.get<string>('log.LOG_FREQUENCY', 'daily');
        const logMaxFiles = config.get<number>('log.LOG_MAX_FILES', 30);
        const logFileEnabled = config.get<boolean>(
          'log.LOG_FILE_ENABLED',
          true,
        );

        // Parse size string (e.g. "10m") to bytes
        const parseSizeToBytes = (size: string): number => {
          const match = size.match(/^(\d+)([kmg]?)$/i);
          if (!match) {
            return 10 * 1024 * 1024;
          }
          const num = parseInt(match[1], 10);
          const unit = match[2]?.toLowerCase();
          const multipliers: Record<string, number> = {
            k: 1024,
            m: 1024 ** 2,
            g: 1024 ** 3,
          };
          return num * (multipliers[unit] || 1);
        };

        // Parse frequency string to milliseconds or keep as-is for pino-roll
        const parseFrequency = (freq: string): number | string => {
          if (freq === 'daily') {
            return 86400000;
          }
          if (freq === 'hourly') {
            return 3600000;
          }
          const ms = parseInt(freq, 10);
          return isNaN(ms) ? 86400000 : ms;
        };

        // File transport: all logs → {appName}.log
        const fileTransport = {
          target: 'pino-roll',
          options: {
            file: `${logDir}/${appName}.log`,
            frequency: parseFrequency(logFrequency),
            size: parseSizeToBytes(logMaxSize),
            limit: { count: logMaxFiles },
            mkdir: true,
            dateFormat: 'yyyy-MM-dd-HH-mm',
          },
        };

        // File transport: errors only → {appName}-error.log
        const errorFileTransport = {
          target: 'pino-roll',
          level: 'error',
          options: {
            file: `${logDir}/${appName}-error.log`,
            frequency: parseFrequency(logFrequency),
            size: parseSizeToBytes(logMaxSize),
            limit: { count: logMaxFiles },
            mkdir: true,
            dateFormat: 'yyyy-MM-dd-HH-mm',
          },
        };

        // Development: pretty console + file logs
        // Production: structured JSON to stdout (docker logs / kubectl logs)
        //   Set LOG_FILE_ENABLED=true to also write file logs
        const transport =
          nodeEnv !== 'production'
            ? {
                targets: [
                  {
                    target: 'pino-pretty',
                    options: { colorize: true },
                    level: 'debug',
                  },
                  { ...fileTransport, level: 'debug' },
                  errorFileTransport,
                ],
              }
            : {
                targets: [
                  {
                    target: 'pino/file',
                    options: { destination: 1 },
                    level: 'info',
                  },
                  ...(logFileEnabled
                    ? [{ ...fileTransport, level: 'info' }, errorFileTransport]
                    : []),
                ],
              };

        return {
          pinoHttp: {
            level: nodeEnv === 'production' ? 'info' : 'debug',
            transport,
            autoLogging: true,
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
            // Attach X-Request-ID to every log line
            genReqId: (req, res) => {
              const existing = req.headers['x-request-id'];
              const id =
                (typeof existing === 'string' ? existing : undefined) ||
                randomUUID();
              req.headers['x-request-id'] = id;
              res.setHeader('x-request-id', id);
              if (typeof existing !== 'string') {
                (
                  req as unknown as { generatedRequestId?: boolean }
                ).generatedRequestId = true;
              }
              return id;
            },
            // Serialize errors with full stack trace
            serializers: {
              err: (err: Error & { code?: string; statusCode?: number }) => ({
                type: err.constructor?.name || 'Error',
                message: err.message,
                stack: err.stack,
                ...(err.code ? { code: err.code } : {}),
                ...(err.statusCode ? { statusCode: err.statusCode } : {}),
              }),
            },
          },
        };
      },
    }),

    // ── Rate Limiting ────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, RedisService],
      useFactory: (config: ConfigService, redis: RedisService) => ({
        storage: new RedisThrottlerStorage(redis),
        throttlers: [
          {
            ttl: config.get<number>('security.THROTTLE_TTL', 60000),
            limit: config.get<number>('security.THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // ── Database ─────────────────────────────────
    PrismaModule,

    // ── Redis ────────────────────────────────────
    RedisModule,

    // ── Caching (Redis-backed via Keyv) ──────────
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('redis.REDIS_HOST', 'localhost');
        const port = config.get<number>('redis.REDIS_PORT', 6379);
        const password = config.get<string>('redis.REDIS_PASSWORD');
        const db = config.get<number>('redis.REDIS_DB', 0);
        const ttl = config.get<number>('redis.CACHE_TTL', 5000);

        const credentials = password ? `:${password}@` : '';
        const redisUrl = `redis://${credentials}${host}:${port}/${db}`;

        return {
          ttl,
          stores: [
            new Keyv({
              store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
            }),
            new KeyvRedis(redisUrl),
          ] as CacheManagerOptions['stores'],
        };
      },
    }),

    // ── Queues (BullMQ + Redis) ──────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.REDIS_HOST', 'localhost'),
          port: config.get<number>('redis.REDIS_PORT', 6379),
          password: config.get<string>('redis.REDIS_PASSWORD') || undefined,
          db: config.get<number>('redis.REDIS_DB', 0),
        },
      }),
    }),

    // ── Feature Modules ──────────────────────────
    HealthModule,
    AuthModule,
    UsersModule,
    ProfileModule,
  ],
  providers: [
    // Global throttler guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global auth guard (JWT + API key, skips @Public())
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    // Global roles guard (checks @Roles() decorator)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global idempotency guard (enforces @RequireIdempotency())
    {
      provide: APP_GUARD,
      useClass: IdempotencyGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, IdempotencyMiddleware).forRoutes('*');
  }
}
