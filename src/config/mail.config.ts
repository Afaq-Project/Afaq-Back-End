import { z } from 'zod';

export const mailConfigSchema = z.object({
  MAIL_HOST: z.string().default('localhost'),
  MAIL_PORT: z.coerce.number().default(1025),
  MAIL_SECURE: z.coerce.boolean().default(false),
  MAIL_USER: z.string().optional(),
  MAIL_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('noreply@afaq.local'),
  MAIL_FROM_NAME: z.string().default('Afaq Dev'),
  MAIL_PREVIEW: z.coerce.boolean().default(true),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
});

export type MailConfig = z.infer<typeof mailConfigSchema>;

export const mailConfig = () => ({
  mail: mailConfigSchema.parse({
    MAIL_HOST: process.env.MAIL_HOST,
    MAIL_PORT: process.env.MAIL_PORT,
    MAIL_SECURE: process.env.MAIL_SECURE,
    MAIL_USER: process.env.MAIL_USER,
    MAIL_PASS: process.env.MAIL_PASS,
    MAIL_FROM: process.env.MAIL_FROM,
    MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
    MAIL_PREVIEW: process.env.MAIL_PREVIEW,
    APP_BASE_URL: process.env.APP_BASE_URL,
  }),
});
