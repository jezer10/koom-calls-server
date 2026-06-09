import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SignalingModule } from './signaling/signaling.module';
import { TurnModule } from './turn/turn.module';

@Module({
  imports: [SignalingModule, TurnModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
