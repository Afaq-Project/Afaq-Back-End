process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL =
  'http://localhost:3000/api/auth/google/callback';
process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client-id';
process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-client-secret';
process.env.LINKEDIN_CALLBACK_URL =
  'http://localhost:3000/api/auth/linkedin/callback';
process.env.OAUTH_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

import { RedisThrottlerStorage } from '../src/common/throttler/redis-throttler.storage';
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalIncrement = RedisThrottlerStorage.prototype.increment;
RedisThrottlerStorage.prototype.increment = async function (
  key: string,
  ttl: number,
  limit: number,
  blockDuration: number,
  throttlerName: string,
) {
  console.log('increment called with limit:', limit, 'key:', key);
  if (limit === 1) {
    return originalIncrement.call(
      this,
      key,
      ttl,
      limit,
      blockDuration,
      throttlerName,
    );
  }
  return {
    totalHits: 1,
    timeToExpire: ttl,
    isBlocked: false,
    timeToBlockExpire: 0,
  };
};
