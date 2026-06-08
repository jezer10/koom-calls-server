import { Module } from '@nestjs/common';
import { SignalingGateway } from './signaling.gateway';
import { RoomRegistry } from './room.registry';

@Module({
  providers: [SignalingGateway, RoomRegistry],
  exports: [RoomRegistry],
})
export class SignalingModule {}
