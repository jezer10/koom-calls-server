import { Module } from '@nestjs/common';
import { SocketIoRedisAdapter } from './socket-io-redis.adapter';
import { APP_CONFIG } from '../config/app-config.module';
import type { AppConfig } from '../config/app.config';

export { SocketIoRedisAdapter } from './socket-io-redis.adapter';
export type { SocketIoRedisAdapterOptions } from './socket-io-redis.adapter';

@Module({
  providers: [
    {
      provide: SocketIoRedisAdapter,
      inject: [APP_CONFIG],
      useFactory: (appConfig: AppConfig) =>
        new SocketIoRedisAdapter(undefined, {
          redisUrl: appConfig.redis.url || undefined,
        }),
    },
  ],
  exports: [SocketIoRedisAdapter],
})
export class SignalingAdapterModule {}
