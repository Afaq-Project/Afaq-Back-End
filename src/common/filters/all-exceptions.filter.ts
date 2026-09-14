import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';
import {
  ApiErrorItem,
  ErrorCode,
  STATUS_TO_ERROR_CODE,
} from '@common/dto/response.dto';
import { toApiDatetime } from '@common/utils/datetime.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.headers['x-request-id'] as string | undefined;

    const startTime = (request as Request & { startTime?: number }).startTime;
    const duration = startTime ? Date.now() - startTime : 0;

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        exceptionResponse = { message: 'Resource not found' };
      } else if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        exceptionResponse = {
          message: 'Resource already exists or conflicts with another record',
        };
      }
    }

    let message = 'An unexpected error occurred';
    let errors: ApiErrorItem[] = [];
    let code: string =
      STATUS_TO_ERROR_CODE[status] ?? ErrorCode.SYSTEM_INTERNAL_ERROR;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      errors = [{ code, message }];
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const res = exceptionResponse as Record<string, unknown>;

      if (res.code) {
        code = res.code as string;
      }

      message = (res.message as string) || message;

      // Structured errors array from exceptionFactory or custom exception
      if (Array.isArray(res.errors)) {
        errors = res.errors as ApiErrorItem[];
      } else if (Array.isArray(res.message)) {
        // Fallback: plain string[] from default ValidationPipe (no exceptionFactory)
        code = ErrorCode.VALIDATION_REQUIRED;
        message = 'Validation failed';
        errors = (res.message as string[]).map((msg) => ({
          code,
          message: msg,
        }));
      } else {
        errors = [{ code, message }];
      }
    } else {
      errors = [{ code, message }];
    }

    if (requestId) {
      response.setHeader('X-Request-ID', requestId);
    }
    response.setHeader('X-Response-Time', `${duration}ms`);

    if (status === 401) {
      response.setHeader('WWW-Authenticate', 'Bearer realm="api"');
    }

    if (status === 429) {
      let retryAfterSeconds = 60;
      if (exception instanceof ThrottlerException) {
        const throttlerResponse = exception.getResponse() as Record<
          string,
          unknown
        >;
        if (typeof throttlerResponse.retryAfter === 'number') {
          retryAfterSeconds = Math.ceil(throttlerResponse.retryAfter / 1000);
        }
      }
      response.setHeader('Retry-After', String(retryAfterSeconds));
    }

    const errorBody = {
      success: false as const,
      status,
      message,
      data: null,
      meta: null,
      errors,
      timestamp: toApiDatetime(new Date()),
    };

    const logContext = {
      statusCode: status,
      errorCode: code,
      method: request.method,
      url: request.url,
      requestId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: (request as Request & { user?: { id: string } }).user?.id,
    };

    if (status >= 500) {
      this.logger.error(
        {
          ...logContext,
          err:
            exception instanceof Error
              ? {
                  message: exception.message,
                  stack: exception.stack,
                  name: exception.name,
                }
              : { message: String(exception) },
        },
        `${request.method} ${request.url} ${status}`,
      );
    } else if (status >= 400) {
      this.logger.warn(
        logContext,
        `${request.method} ${request.url} ${status} – ${code}`,
      );
    }

    response.status(status).json(errorBody);
  }
}
