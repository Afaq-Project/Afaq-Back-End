import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage,  } from '@nestjs/throttler';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ): Promise<any> {
    try {
      const multi = this.redisService.client.multi();
      multi.incr(key);
      multi.pttl(key);
      const results = await multi.exec();

      if (!results) {
        return this.failOpen();
      }

      const totalHits = results[0][1] as number;
      let timeToExpire = results[1][1] as number;

      if (totalHits === 1 || timeToExpire < 0) {
        await this.redisService.client.pexpire(key, ttl);
        timeToExpire = ttl;
      }

      return {
        totalHits,
        timeToExpire: Math.ceil(timeToExpire / 1000),
        isBlocked: totalHits > limit,
        timeToBlockExpire: 0,
      };
    } catch (error) {
      this.logger.warn(`Redis throttler failed, bypassing (fail-open): ${(error as any).message || error}`);
      return this.failOpen();
    }
  }

  private failOpen(): any  {
    return {
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
