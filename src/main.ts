import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import {
  ValidationPipe,
  VersioningType,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from '@common/filters';
import { TransformInterceptor, TimeoutInterceptor } from '@common/interceptors';
import { ErrorCode } from '@common/dto/response.dto';

function constraintToErrorCode(constraintKey: string): string {
  const map: Record<string, string> = {
    isNotEmpty: ErrorCode.VALIDATION_REQUIRED,
    isDefined: ErrorCode.VALIDATION_REQUIRED,
    isEmail: ErrorCode.VALIDATION_INVALID_FORMAT,
    isUrl: ErrorCode.VALIDATION_INVALID_FORMAT,
    matches: ErrorCode.VALIDATION_INVALID_FORMAT,
    isEnum: ErrorCode.VALIDATION_INVALID_ENUM,
    isIn: ErrorCode.VALIDATION_INVALID_ENUM,
    minLength: ErrorCode.VALIDATION_TOO_SHORT,
    maxLength: ErrorCode.VALIDATION_TOO_LONG,
    min: ErrorCode.VALIDATION_TOO_SMALL,
    max: ErrorCode.VALIDATION_TOO_LARGE,
    isInt: ErrorCode.VALIDATION_INVALID_TYPE,
    isNumber: ErrorCode.VALIDATION_INVALID_TYPE,
    isBoolean: ErrorCode.VALIDATION_INVALID_TYPE,
    isString: ErrorCode.VALIDATION_INVALID_TYPE,
    isDate: ErrorCode.VALIDATION_INVALID_DATE,
    isDateString: ErrorCode.VALIDATION_INVALID_DATE,
    whitelistValidation: ErrorCode.UNKNOWN_FIELD,
    isUuid: ErrorCode.VALIDATION_ERROR,
  };
  return map[constraintKey] ?? ErrorCode.VALIDATION_INVALID_FORMAT;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const port = config.get<number>('app.PORT', 3000);
  const prefix = config.get<string>('app.API_PREFIX', 'api');
  const nodeEnv = config.get<string>('app.NODE_ENV', 'development');

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  const express = await import('express');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  const corsOrigins = config.get<string[]>('security.CORS_ORIGINS', [
    'http://localhost:3000',
  ]);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-API-Key',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-ID', 'X-Response-Time'],
  });

  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors: ValidationError[]) => {
        const errList = errors.flatMap((err) =>
          Object.keys(err.constraints ?? {}).map((constraintKey) => ({
            field: err.property,
            code:
              err.contexts?.[constraintKey]?.errorCode ||
              constraintToErrorCode(constraintKey),
            message: (err.constraints ?? {})[constraintKey],
          })),
        );
        return new BadRequestException({
          message: 'Validation failed',
          errors: errList,
        });
      },
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new TransformInterceptor(reflector),
    new TimeoutInterceptor(),
  );

  // ── Swagger ─────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Levora API')
    .setDescription('Levora Intelligent Opportunity Discovery Platform API')
    .setVersion('1.2')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'X-API-Key')
    .addServer(`http://localhost:${port}`)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // Serve swagger JSON at /api-json
  app.getHttpAdapter().get(
    '/api-json',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_req: any, res: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      res.json(document);
    },
  );

  app.enableShutdownHooks();

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Server running on http://localhost:${port}/${prefix}`);
  logger.log(`📖 Environment: ${nodeEnv}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api`);
  logger.log(`📄 Swagger JSON: http://localhost:${port}/api-json`);
}

void bootstrap();
