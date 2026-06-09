import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CoturnTurnService, TURN_CONFIG } from './turn.service';
import { JwtStrategy } from './jwt.strategy';
import { TurnController } from './turn.controller';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [TurnController],
  providers: [
    {
      provide: TURN_CONFIG,
      useFactory: () => CoturnTurnService.fromEnv(),
    },
    CoturnTurnService,
    JwtStrategy,
  ],
  exports: [CoturnTurnService],
})
export class TurnModule {}
