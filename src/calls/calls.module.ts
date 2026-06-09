import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TurnModule } from '../turn/turn.module';
import { SfuModule } from '../sfu/sfu.module';
import { CallsController } from './calls.controller';
import { CallsService, CallEventsStore } from './calls.service';

@Module({
  imports: [AuthModule, TurnModule, SfuModule],
  controllers: [CallsController],
  providers: [CallsService, CallEventsStore],
  exports: [CallsService, CallEventsStore],
})
export class CallsModule {}
