import {
  ArgumentMetadata,
  Injectable,
  Type,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_EXTRA_FIELDS_KEY } from '../decorators/allow-extra-fields.decorator';

@Injectable()
export class ConfigurableValidationPipe extends ValidationPipe {
  private readonly tolerantPipe: ValidationPipe;

  constructor(
    private readonly reflector: Reflector,
    options?: ValidationPipeOptions,
  ) {
    // `super` is the strict pipe — reused directly, no third instance created.
    super({
      ...options,
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    this.tolerantPipe = new ValidationPipe({
      ...options,
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    });
  }

  async transform(value: unknown, metadata: ArgumentMetadata) {
    const targets: Type<unknown>[] = metadata.metatype
      ? [metadata.metatype]
      : [];
    const allowExtra = this.reflector.getAllAndOverride<boolean>(
      ALLOW_EXTRA_FIELDS_KEY,
      targets,
    );

    if (allowExtra) {
      return this.tolerantPipe.transform(value, metadata);
    }
    return super.transform(value, metadata);
  }
}
