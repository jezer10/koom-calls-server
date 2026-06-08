import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SignalingModule } from './signaling/signaling.module';
import {
  SignalingAdapterModule,
  SocketIoRedisAdapter,
} from './signaling/signaling.adapter.module';

export { SocketIoRedisAdapter } from './signaling/signaling.adapter.module';

@Module({
  imports: [SignalingModule, SignalingAdapterModule],
  controllers: [AppController],
  providers: [AppService, SocketIoRedisAdapter],
  exports: [SocketIoRedisAdapter],
})
export class AppModule {}
