import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import {
  VerificationEmailJobPayload,
  PasswordResetEmailJobPayload,
} from './interfaces/mail.interface';

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  async process(
    job: Job<
      VerificationEmailJobPayload | PasswordResetEmailJobPayload,
      void,
      string
    >,
  ): Promise<void> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'sendVerification':
        await this.handleSendVerification(job.data);
        break;
      case 'sendPasswordReset':
        await this.handleSendPasswordReset(job.data);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSendVerification(
    data: VerificationEmailJobPayload,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: data.to,
        subject: 'Verify your email address',
        template: './verify-email',
        context: {
          url: data.url,
        },
      });
      this.logger.log(`Verification email sent to ${data.to}`);
    } catch (e) {
      const error = e as Error;
      this.logger.error(
        `Failed to send verification email to ${data.to}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleSendPasswordReset(
    data: PasswordResetEmailJobPayload,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: data.to,
        subject: 'Password Reset Request',
        template: './reset-password',
        context: {
          url: data.url,
        },
      });
      this.logger.log(`Password reset email sent to ${data.to}`);
    } catch (e) {
      const error = e as Error;
      this.logger.error(
        `Failed to send password reset email to ${data.to}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
