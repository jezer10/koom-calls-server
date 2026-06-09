import { Module } from '@nestjs/common';
import {
  CALLS_REPOSITORY,
  CALL_EVENTS_REPOSITORY,
  type CallEventsRepository,
  type CallsRepository,
} from './calls.repository.interface';
import { CallsController, MeCallsController } from './calls.controller';
import { CallsService } from './calls.service';
import {
  CALL_STATE_MACHINE,
  createCallStateMachine,
} from './domain/call-state.machine';
import {
  InMemoryCallsRepository,
  InMemoryCallEventsRepository,
} from './in-memory.repositories';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CallsController, MeCallsController],
  providers: [
    CallsService,
    {
      provide: CALL_STATE_MACHINE,
      useFactory: () => createCallStateMachine(),
    },
    {
      provide: CALLS_REPOSITORY,
      useFactory: (): CallsRepository => new InMemoryCallsRepository(),
    },
    {
      provide: CALL_EVENTS_REPOSITORY,
      useFactory: (): CallEventsRepository =>
        new InMemoryCallEventsRepository(),
    },
  ],
  exports: [CallsService, CALL_STATE_MACHINE],
})
export class CallsModule {}
