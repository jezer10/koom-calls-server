import { Module } from '@nestjs/common';
import { InMemoryPresenceService } from './in-memory-presence.service';
import { PRESENCE_SERVICE } from './presence.tokens';
import type { PresenceService } from './presence.service';
import { createRedisClient } from './redis.client';
import { RedisPresenceService } from './redis-presence.service';

@Module({
  providers: [
    {
      provide: PRESENCE_SERVICE,
      useFactory: (): PresenceService => {
        const url = process.env.REDIS_URL;
        if (!url || url.trim() === '') {
          return new InMemoryPresenceService();
        }
        const client = createRedisClient({ url });
        return new RedisPresenceService(client);
      },
    },
  ],
  exports: [PRESENCE_SERVICE],
})
export class PresenceModule {}
