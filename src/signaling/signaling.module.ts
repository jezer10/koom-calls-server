import { Module } from '@nestjs/common';
import { SignalingGateway } from './signaling.gateway';
import { RoomRegistry } from './room.registry';
import { NoopCallsEventBus, CALLS_EVENT_BUS } from './calls-event-bus';

@Module({
  providers: [
    SignalingGateway,
    RoomRegistry,
    {
      provide: CALLS_EVENT_BUS,
      useClass: NoopCallsEventBus,
    },
  ],
  exports: [RoomRegistry, CALLS_EVENT_BUS, SignalingGateway],
})
export class SignalingModule {}
