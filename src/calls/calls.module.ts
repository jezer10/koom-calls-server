import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallEventsRepository } from './call-events.repository';
import { CallsRepository } from './calls.repository';
import { CallEntity } from './domain/call.entity';
import { CallEventEntity } from './domain/call-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CallEntity, CallEventEntity])],
  providers: [CallsRepository, CallEventsRepository],
  exports: [CallsRepository, CallEventsRepository],
})
export class CallsModule {}
