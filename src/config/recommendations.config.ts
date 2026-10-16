import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  RECOMMENDATIONS_MATCHES_CACHE_TTL_SEC: z.coerce.number().default(1800),
  RECOMMENDATIONS_COMBINED_CACHE_TTL_SEC: z.coerce.number().default(300),
});

export const recommendationsConfig = registerAs('recommendations', () => {
  return schema.parse(process.env);
});
