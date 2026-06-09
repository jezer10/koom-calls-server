import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocketIoRedisAdapter } from './socket-io-redis.adapter';

export { SocketIoRedisAdapter } from './socket-io-redis.adapter';
export type { SocketIoRedisAdapterOptions } from './socket-io-redis.adapter';

@Module({
  providers: [
    {
      provide: SocketIoRedisAdapter,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new SocketIoRedisAdapter(undefined, {
          redisUrl: configService.get<string>('REDIS_URL') ?? undefined,
        }),
    },
  ],
  exports: [SocketIoRedisAdapter],
})
export class SignalingAdapterModule {}
