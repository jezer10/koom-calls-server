import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InMemoryPresenceService } from './in-memory-presence.service';
import { PRESENCE_SERVICE } from './presence.tokens';
import type { PresenceService } from './presence.service';
import { canConnectRedis, createRedisClient } from './redis.client';
import { RedisPresenceService } from './redis-presence.service';

@Module({
  providers: [
    {
      provide: PRESENCE_SERVICE,
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<PresenceService> => {
        const url = configService.get<string>('redis.url') ?? '';
        const defaultTtl =
          configService.get<number>('presence.ttlSeconds') ?? 60;
        if (url.trim() === '') {
          return new InMemoryPresenceService(defaultTtl);
        }
        if (!(await canConnectRedis(url))) {
          new Logger(PresenceModule.name).warn(
            'Redis unavailable; using in-memory presence fallback',
          );
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
