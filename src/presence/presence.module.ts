import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InMemoryPresenceService } from './in-memory-presence.service';
import { PRESENCE_SERVICE } from './presence.tokens';
import type { PresenceService } from './presence.service';
import { createRedisClient } from './redis.client';
import { RedisPresenceService } from './redis-presence.service';

@Module({
  providers: [
    {
      provide: PRESENCE_SERVICE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): PresenceService => {
        const url = configService.get<string>('REDIS_URL') ?? '';
        const defaultTtl = configService.getOrThrow<number>(
          'PRESENCE_TTL_SECONDS',
        );
        if (url.trim() === '') {
          return new InMemoryPresenceService(defaultTtl);
        }
        const client = createRedisClient({ url });
        return new RedisPresenceService(client, defaultTtl);
      },
    },
  ],
  exports: [PRESENCE_SERVICE],
})
export class PresenceModule {}
