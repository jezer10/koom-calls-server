import { Module } from '@nestjs/common';
import { StaticTurnService } from './turn.service';
import { TURN_SERVICE } from './turn.types';

@Module({
  providers: [
    StaticTurnService,
    {
      provide: TURN_SERVICE,
      useExisting: StaticTurnService,
    },
  ],
  exports: [TURN_SERVICE, StaticTurnService],
})
export class TurnModule {}
