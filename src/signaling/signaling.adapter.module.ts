import { Module } from '@nestjs/common';
import { SocketIoRedisAdapter } from './socket-io-redis.adapter';

export { SocketIoRedisAdapter } from './socket-io-redis.adapter';
export type { SocketIoRedisAdapterOptions } from './socket-io-redis.adapter';

@Module({
  providers: [SocketIoRedisAdapter],
  exports: [SocketIoRedisAdapter],
})
export class SignalingAdapterModule {}
