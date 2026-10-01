import { z } from 'zod';

/**
 * Database configuration schema.
 */
export const databaseConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_AIService_URL: z.string().url(),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

export const databaseConfig = () => ({
  database: databaseConfigSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_AIService_URL: process.env.DATABASE_AIService_URL,
  }),
});
