import { Transform } from 'class-transformer';

export const SanitizeString = () =>
  Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.replace(/<[^>]*>?/gm, '').trim();
    }
    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.map((v) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        typeof v === 'string' ? v.replace(/<[^>]*>?/gm, '').trim() : v,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  });
