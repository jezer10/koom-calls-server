import { Module } from '@nestjs/common';
import { InMemoryPresenceService } from './in-memory-presence.service';
import { PRESENCE_SERVICE } from './presence.tokens';
import type { PresenceService } from './presence.service';
import { createRedisClient } from './redis.client';
import { RedisPresenceService } from './redis-presence.service';
import { APP_CONFIG } from '../config/app-config.module';
import type { AppConfig } from '../config/app.config';

@Module({
  providers: [
    {
      provide: PRESENCE_SERVICE,
      inject: [APP_CONFIG],
      useFactory: (appConfig: AppConfig): PresenceService => {
        const url = appConfig.redis.url;
        const defaultTtl = appConfig.presence.ttlSeconds;
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
