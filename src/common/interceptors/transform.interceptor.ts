import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import {
  DEPRECATED_KEY,
  DeprecatedOptions,
} from '@common/decorators/deprecated.decorator';
import { RESPONSE_MESSAGE_KEY } from '@common/decorators/response-message.decorator';
import { toApiDatetime } from '@common/utils/datetime.util';

type RequestWithMeta = Request & { generatedRequestId?: boolean };

interface PaginatedShape {
  data: unknown[];
  meta: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
}

function isPaginated(value: unknown): value is PaginatedShape {
  return (
    value !== null &&
    typeof value === 'object' &&
    'data' in value &&
    'meta' in value &&
    typeof (value as Record<string, unknown>).meta === 'object'
  );
}

function getAutoMessage(method: string, statusCode: number): string {
  if (statusCode === 201) {
    return 'Created successfully';
  }
  if (method === 'PATCH' || method === 'PUT') {
    return 'Updated successfully';
  }
  return 'OK';
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithMeta>();
    const response = httpContext.getResponse<Response>();
    const serverGeneratedId = request.generatedRequestId === true;
    const requestId = request.headers['x-request-id'] as string | undefined;

    const customMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const deprecatedOptions = this.reflector.getAllAndOverride<
      DeprecatedOptions | undefined
    >(DEPRECATED_KEY, [context.getHandler(), context.getClass()]);

    return next.handle().pipe(
      map((responseData: unknown) => {
        const statusCode = response.statusCode;
        const duration = Date.now() - startTime;

        if (requestId) {
          response.setHeader('X-Request-ID', requestId);
        }
        response.setHeader('X-Response-Time', `${duration}ms`);

        const deprecationMeta = deprecatedOptions
          ? {
              message:
                'This endpoint is deprecated and will be removed in a future version.',
              sunsetDate: new Date(deprecatedOptions.sunsetDate).toISOString(),
              replacement: deprecatedOptions.replacement,
            }
          : undefined;
        if (deprecatedOptions) {
          response.setHeader('Deprecation', 'true');
          response.setHeader(
            'Sunset',
            new Date(deprecatedOptions.sunsetDate).toUTCString(),
          );
          response.setHeader(
            'Link',
            `<${deprecatedOptions.replacement}>; rel="successor-version"`,
          );
        }

        const requestIdMeta =
          serverGeneratedId && requestId ? { requestId } : undefined;

        const timestamp = toApiDatetime(new Date());
        const message =
          customMessage || getAutoMessage(request.method, statusCode);

        const isAlreadyWrapped =
          responseData !== null &&
          typeof responseData === 'object' &&
          'status' in responseData &&
          'data' in responseData;

        const wrappedResponse = isAlreadyWrapped
          ? (responseData as { data: unknown; message?: string })
          : null;

        const finalData = wrappedResponse ? wrappedResponse.data : responseData;
        const finalMessage =
          wrappedResponse?.message &&
          typeof wrappedResponse.message === 'string'
            ? wrappedResponse.message
            : message;

        if (isPaginated(finalData)) {
          const { data, meta: originalMeta } = finalData;
          return {
            success: true,
            status: statusCode,
            message: finalMessage,
            error: null,
            data,
            meta: {
              ...originalMeta,
              ...requestIdMeta,
              ...(deprecationMeta ? { deprecation: deprecationMeta } : {}),
            },
            errors: null,
            timestamp,
          };
        }

        const meta =
          requestIdMeta || deprecationMeta
            ? {
                ...requestIdMeta,
                ...(deprecationMeta ? { deprecation: deprecationMeta } : {}),
              }
            : null;

        return {
          success: true,
          status: statusCode,
          message: finalMessage,
          error: null,
          data: finalData,
          meta,
          errors: null,
          timestamp,
        };
      }),
    );
  }
}
