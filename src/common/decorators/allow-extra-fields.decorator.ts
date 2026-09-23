import { SetMetadata } from '@nestjs/common';

export const ALLOW_EXTRA_FIELDS_KEY = 'allowExtraFields';

/**
 * Marks a DTO class as tolerant of undeclared fields.
 *
 * MUST be applied to a DTO class — NOT to a controller or route handler.
 * `ConfigurableValidationPipe` reads this metadata from `metadata.metatype`,
 * which NestJS resolves only to the DTO class. Decorators placed on
 * controllers are invisible to the pipe and have no effect.
 *
 * Use only on public, read-only endpoints (e.g. `/reference/*`) where
 * external tools may append tracking or cache-busting query params.
 * Never apply to authenticated or write endpoints.
 */
export const AllowExtraFields = () => SetMetadata(ALLOW_EXTRA_FIELDS_KEY, true);
