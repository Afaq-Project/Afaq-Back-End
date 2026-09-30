import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import {
  VerificationEmailJobPayload,
  PasswordResetEmailJobPayload,
} from './interfaces/mail.interface';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly appBaseUrl: string;

  constructor(
    @InjectQueue('mail')
    private readonly mailQueue: Queue<
      VerificationEmailJobPayload | PasswordResetEmailJobPayload,
      void,
      string
    >,
    private readonly configService: ConfigService,
  ) {
    this.appBaseUrl = this.configService.get<string>(
      'mail.APP_BASE_URL',
      'http://localhost:3000',
    );
  }

  /**
   * Enqueues a verification email to be sent asynchronously.
   * @param userId The ID of the user
   * @param email The destination email address
   * @param token The raw verification token
   */
  async sendVerificationEmail(
    userId: string,
    email: string,
    token: string,
  ): Promise<void> {
    try {
      const url = `${this.appBaseUrl}/api/v1/auth/verify-email?token=${token}`;
      const payload: VerificationEmailJobPayload = {
        to: email,
        url,
        userId,
      };
      await this.mailQueue.add('sendVerification', payload);
      this.logger.log(`Enqueued verification email for ${email}`);
    } catch (e) {
      const error = e as Error;
      this.logger.error(
        `Failed to enqueue verification email for ${email}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to dispatch email');
    }
  }

  /**
   * Enqueues a password reset email to be sent asynchronously.
   * @param userId The ID of the user
   * @param email The destination email address
   * @param token The raw password reset token
   */
  async sendPasswordResetEmail(
    userId: string,
    email: string,
    token: string,
  ): Promise<void> {
    try {
      const url = `${this.appBaseUrl}/reset-password?token=${token}`;
      const payload: PasswordResetEmailJobPayload = {
        to: email,
        url,
        userId,
      };
      await this.mailQueue.add('sendPasswordReset', payload);
      this.logger.log(`Enqueued password reset email for ${email}`);
    } catch (e) {
      const error = e as Error;
      this.logger.error(
        `Failed to enqueue password reset email for ${email}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to dispatch email');
    }
  }
}
