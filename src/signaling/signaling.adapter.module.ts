import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocketIoRedisAdapter } from './socket-io-redis.adapter';
import { canConnectRedis } from '../presence/redis.client';

export { SocketIoRedisAdapter } from './socket-io-redis.adapter';
export type { SocketIoRedisAdapterOptions } from './socket-io-redis.adapter';

@Module({
  providers: [
    {
      provide: SocketIoRedisAdapter,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrlValue = configService.get<string>('redis.url') ?? '';
        const redisUrl =
          redisUrlValue && (await canConnectRedis(redisUrlValue))
            ? redisUrlValue
            : undefined;
        if (redisUrlValue && !redisUrl) {
          new Logger(SignalingAdapterModule.name).warn(
            'Redis unavailable; Socket.IO will use the in-memory adapter',
          );
        }
        return new SocketIoRedisAdapter(undefined, { redisUrl });
      },
    },
  ],
  exports: [SocketIoRedisAdapter],
})
export class SignalingAdapterModule {}
