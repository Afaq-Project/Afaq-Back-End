import { ValidationPipe } from '@nestjs/common';
import { ListOpportunitiesDto } from './list-opportunities.dto';

describe('ListOpportunitiesDto', () => {
  let validationPipe: ValidationPipe;

  beforeEach(() => {
    validationPipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    });
  });

  const validate = async (obj: any): Promise<any> => {
    return validationPipe.transform(obj, {
      type: 'query',
      metatype: ListOpportunitiesDto,
    });
  };

  it('Valid default (empty object) — passes validation', async () => {
    const result = await validate({});
    expect(result).toBeInstanceOf(ListOpportunitiesDto);
  });

  it('limit=9999 — passes DTO validation', async () => {
    const result = await validate({ limit: 9999 });
    expect(result.limit).toBe(9999);
  });

  it('page=0 — fails with @Min(1) error', async () => {
    await expect(validate({ page: 0 })).rejects.toThrow();
  });

  it('is_remote="true" — coerced to true (boolean)', async () => {
    const result = await validate({ is_remote: 'true' });
    expect(result.is_remote).toBe(true);
  });

  it('is_remote="false" — coerced to false (boolean)', async () => {
    const result = await validate({ is_remote: 'false' });
    expect(result.is_remote).toBe(false);
  });

  it('source_id="not-a-uuid" — fails @IsUUID', async () => {
    await expect(validate({ source_id: 'not-a-uuid' })).rejects.toThrow();
  });

  it('deadline_from="not-a-date" — fails @IsDateString', async () => {
    await expect(validate({ deadline_from: 'not-a-date' })).rejects.toThrow();
  });

  it('q longer than 500 chars — fails @MaxLength(500)', async () => {
    const q = 'a'.repeat(501);
    await expect(validate({ q })).rejects.toThrow();
  });

  it('Extra unknown field — rejected by ValidationPipe', async () => {
    await expect(validate({ unknown_field: 'hello' })).rejects.toThrow();
  });
});
