import { EmailRateLimitGuard } from './email-rate-limit.guard';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

describe('EmailRateLimitGuard', () => {
  let guard: any;

  beforeEach(() => {
    // We only need to test the protected getTracker method, so we cast to any
    // to bypass TypeScript's protected access modifier in the test.
    guard = new EmailRateLimitGuard(
      {} as any,
      {} as ThrottlerStorage,
      new Reflector(),
    );
  });

  it('should return IP-email if email is present and valid', async () => {
    const req = {
      body: { email: 'TEST@example.com' },
      ip: '127.0.0.1',
    };
    const tracker = await guard.getTracker(req);
    expect(tracker).toBe('127.0.0.1-test@example.com');
  });

  it('should fallback to first IP in ips array if email is missing', async () => {
    const req = {
      body: {},
      ips: ['10.0.0.1', '10.0.0.2'],
      ip: '127.0.0.1',
    };
    const tracker = await guard.getTracker(req);
    expect(tracker).toBe('10.0.0.1');
  });

  it('should fallback to ip if email and ips are missing', async () => {
    const req = {
      body: {},
      ip: '192.168.1.1',
    };
    const tracker = await guard.getTracker(req);
    expect(tracker).toBe('192.168.1.1');
  });

  it('should fallback to "unknown" if nothing is present', async () => {
    const req = {
      body: {},
    };
    const tracker = await guard.getTracker(req);
    expect(tracker).toBe('unknown');
  });

  it('should fallback to IP if email is invalid type', async () => {
    const req = {
      body: { email: { invalid: true } },
      ip: '192.168.1.1',
    };
    const tracker = await guard.getTracker(req);
    expect(tracker).toBe('192.168.1.1');
  });
});
