import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class EmailRateLimitGuard extends ThrottlerGuard {
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as {
      body?: { email?: unknown };
      ips?: string[];
      ip?: string;
    };
    const ip = request.ips?.length ? request.ips[0] : (request.ip ?? 'unknown');
    const email = request.body?.email;
    if (email && typeof email === 'string') {
      return `${ip}-${email.toLowerCase()}`;
    }
    // Fallback to IP if email is not present or invalid
    return ip;
  }
}
