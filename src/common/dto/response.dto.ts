import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─────────────────────────────────────────────
// ERROR ITEM
// ─────────────────────────────────────────────

export class ApiErrorItem {
  @ApiPropertyOptional({
    example: 'email',
    description: 'Field that caused the error',
  })
  field?: string;

  @ApiProperty({
    example: 'USER_EMAIL_DUPLICATE',
    description: 'SCREAMING_SNAKE_CASE error code',
  })
  code: string;

  @ApiProperty({ example: 'This email is already registered' })
  message: string;
}

// ─────────────────────────────────────────────
// PAGINATION META
// ─────────────────────────────────────────────

export class PaginationMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 248 })
  total: number;

  @ApiProperty({ example: 13 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNext: boolean;

  @ApiProperty({ example: false })
  hasPrev: boolean;
}

export class MetaWithPagination {
  @ApiProperty({ type: PaginationMeta })
  pagination: PaginationMeta;
}

// ─────────────────────────────────────────────
// SUCCESS RESPONSES
// ─────────────────────────────────────────────

export class SuccessResponse<T = unknown> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty({ example: 'OK' })
  message: string;

  @ApiProperty()
  data: T;

  @ApiPropertyOptional({ nullable: true })
  meta: MetaWithPagination | null;

  @ApiProperty({ nullable: true, example: null, type: Object })
  errors: null;

  @ApiProperty({ example: '2026-04-22T00:00:00+00:00' })
  timestamp: string;
}

export class PaginatedResponse<T = unknown> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty({ example: 'OK' })
  message: string;

  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ type: MetaWithPagination })
  meta: MetaWithPagination;

  @ApiProperty({ nullable: true, example: null, type: Object })
  errors: null;

  @ApiProperty({ example: '2026-04-22T00:00:00+00:00' })
  timestamp: string;
}

// ─────────────────────────────────────────────
// ERROR RESPONSES
// ─────────────────────────────────────────────

export class ErrorResponse {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ example: 404 })
  status: number;

  @ApiProperty({ example: 'User not found' })
  message: string;

  @ApiProperty({ nullable: true, example: null, type: Object })
  data: null;

  @ApiProperty({ nullable: true, example: null, type: Object })
  meta: null;

  @ApiProperty({ type: [ApiErrorItem] })
  errors: ApiErrorItem[];

  @ApiProperty({ example: '2026-04-22T00:00:00+00:00' })
  timestamp: string;
}

// ─────────────────────────────────────────────
// ERROR CODES ENUM — DOMAIN_SUBJECT_REASON
// ─────────────────────────────────────────────

export enum ErrorCode {
  // AUTH
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_REVOKED = 'AUTH_TOKEN_REVOKED',
  AUTH_REFRESH_TOKEN_EXPIRED = 'AUTH_REFRESH_TOKEN_EXPIRED',
  AUTH_PERMISSION_DENIED = 'AUTH_PERMISSION_DENIED',
  AUTH_ROLE_INSUFFICIENT = 'AUTH_ROLE_INSUFFICIENT',
  AUTH_LOGIN_INVALID_CREDENTIALS = 'AUTH_LOGIN_INVALID_CREDENTIALS',
  AUTH_LOGIN_TOO_MANY_ATTEMPTS = 'AUTH_LOGIN_TOO_MANY_ATTEMPTS',
  AUTH_2FA_CODE_INVALID = 'AUTH_2FA_CODE_INVALID',
  AUTH_2FA_CODE_EXPIRED = 'AUTH_2FA_CODE_EXPIRED',

  // USER
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_EMAIL_DUPLICATE = 'USER_EMAIL_DUPLICATE',
  USER_ACCOUNT_DISABLED = 'USER_ACCOUNT_DISABLED',
  USER_EMAIL_INVALID = 'USER_EMAIL_INVALID',
  USER_EMAIL_NOT_VERIFIED = 'USER_EMAIL_NOT_VERIFIED',
  USER_PASSWORD_TOO_SHORT = 'USER_PASSWORD_TOO_SHORT',
  USER_PASSWORD_TOO_WEAK = 'USER_PASSWORD_TOO_WEAK',
  USER_PASSWORD_INCORRECT = 'USER_PASSWORD_INCORRECT',
  USER_ACCOUNT_DELETED = 'USER_ACCOUNT_DELETED',
  USER_PHONE_DUPLICATE = 'USER_PHONE_DUPLICATE',
  USER_PHONE_INVALID = 'USER_PHONE_INVALID',

  // VALIDATION
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_FIELD = 'UNKNOWN_FIELD',
  VALIDATION_REQUIRED = 'VALIDATION_REQUIRED',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_INVALID_TYPE = 'VALIDATION_INVALID_TYPE',
  VALIDATION_TOO_SHORT = 'VALIDATION_TOO_SHORT',
  VALIDATION_TOO_LONG = 'VALIDATION_TOO_LONG',
  VALIDATION_TOO_SMALL = 'VALIDATION_TOO_SMALL',
  VALIDATION_TOO_LARGE = 'VALIDATION_TOO_LARGE',
  VALIDATION_INVALID_ENUM = 'VALIDATION_INVALID_ENUM',
  VALIDATION_INVALID_DATE = 'VALIDATION_INVALID_DATE',
  VALIDATION_DATE_IN_PAST = 'VALIDATION_DATE_IN_PAST',
  VALIDATION_DATE_IN_FUTURE = 'VALIDATION_DATE_IN_FUTURE',

  // PROFILE
  BIO_TOO_LONG = 'BIO_TOO_LONG',
  CITY_COUNTRY_MISMATCH = 'CITY_COUNTRY_MISMATCH',
  INVALID_MARITAL_STATUS = 'INVALID_MARITAL_STATUS',

  // FILE
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_UPLOAD_TOO_LARGE = 'FILE_UPLOAD_TOO_LARGE',
  FILE_UPLOAD_INVALID_TYPE = 'FILE_UPLOAD_INVALID_TYPE',
  FILE_UPLOAD_CORRUPTED = 'FILE_UPLOAD_CORRUPTED',
  FILE_UPLOAD_LIMIT_EXCEEDED = 'FILE_UPLOAD_LIMIT_EXCEEDED',
  FILE_STORAGE_FULL = 'FILE_STORAGE_FULL',

  // SYSTEM
  SYSTEM_INTERNAL_ERROR = 'SYSTEM_INTERNAL_ERROR',
  SYSTEM_BAD_REQUEST = 'SYSTEM_BAD_REQUEST',
  SYSTEM_RESOURCE_NOT_FOUND = 'SYSTEM_RESOURCE_NOT_FOUND',
  SYSTEM_METHOD_NOT_ALLOWED = 'SYSTEM_METHOD_NOT_ALLOWED',
  SYSTEM_RATE_LIMIT_EXCEEDED = 'SYSTEM_RATE_LIMIT_EXCEEDED',
  SYSTEM_SERVICE_UNAVAILABLE = 'SYSTEM_SERVICE_UNAVAILABLE',
  SYSTEM_REQUEST_TIMEOUT = 'SYSTEM_REQUEST_TIMEOUT',
  SYSTEM_NOT_IMPLEMENTED = 'SYSTEM_NOT_IMPLEMENTED',
  SYSTEM_BAD_GATEWAY = 'SYSTEM_BAD_GATEWAY',
  SYSTEM_GATEWAY_TIMEOUT = 'SYSTEM_GATEWAY_TIMEOUT',
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR',
  SYSTEM_ENDPOINT_REMOVED = 'SYSTEM_ENDPOINT_REMOVED',
  SYSTEM_UNSUPPORTED_MEDIA_TYPE = 'SYSTEM_UNSUPPORTED_MEDIA_TYPE',
  SYSTEM_IDEMPOTENCY_KEY_CONFLICT = 'SYSTEM_IDEMPOTENCY_KEY_CONFLICT',
  SYSTEM_REQUEST_IN_PROGRESS = 'SYSTEM_REQUEST_IN_PROGRESS',
}

export const STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.SYSTEM_BAD_REQUEST,
  401: ErrorCode.AUTH_TOKEN_MISSING,
  403: ErrorCode.AUTH_PERMISSION_DENIED,
  404: ErrorCode.SYSTEM_RESOURCE_NOT_FOUND,
  405: ErrorCode.SYSTEM_METHOD_NOT_ALLOWED,
  408: ErrorCode.SYSTEM_REQUEST_TIMEOUT,
  409: ErrorCode.SYSTEM_REQUEST_IN_PROGRESS,
  410: ErrorCode.SYSTEM_ENDPOINT_REMOVED,
  413: ErrorCode.FILE_UPLOAD_TOO_LARGE,
  415: ErrorCode.SYSTEM_UNSUPPORTED_MEDIA_TYPE,
  422: ErrorCode.VALIDATION_REQUIRED,
  429: ErrorCode.SYSTEM_RATE_LIMIT_EXCEEDED,
  500: ErrorCode.SYSTEM_INTERNAL_ERROR,
  501: ErrorCode.SYSTEM_NOT_IMPLEMENTED,
  502: ErrorCode.SYSTEM_BAD_GATEWAY,
  503: ErrorCode.SYSTEM_SERVICE_UNAVAILABLE,
  504: ErrorCode.SYSTEM_GATEWAY_TIMEOUT,
  507: ErrorCode.FILE_STORAGE_FULL,
};
