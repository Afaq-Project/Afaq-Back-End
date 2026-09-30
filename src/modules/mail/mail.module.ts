import { Global, Module } from '@nestjs/common';
import { MailerModule, MailerOptions } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { join } from 'path';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailerOptions => ({
        transport: {
          host: config.get<string>('mail.MAIL_HOST', '127.0.0.1'),
          port: config.get<number>('mail.MAIL_PORT', 1025),
          secure: config.get<boolean>('mail.MAIL_SECURE', false),
          auth: config.get<string>('mail.MAIL_USER')
            ? {
                user: config.get<string>('mail.MAIL_USER'),
                pass: config.get<string>('mail.MAIL_PASS'),
              }
            : undefined,
        },
        defaults: {
          from: `"${config.get<string>('mail.MAIL_FROM_NAME', 'Afaq Dev')}" <${config.get<string>('mail.MAIL_FROM', 'noreply@afaq.local')}>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
        preview: config.get<boolean>('mail.MAIL_PREVIEW', true),
      }),
    }),
    BullModule.registerQueue({
      name: 'mail',
    }),
  ],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
