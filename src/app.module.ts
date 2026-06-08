import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PresenceModule } from './presence/presence.module';
import { SignalingModule } from './signaling/signaling.module';

@Module({
  imports: [PresenceModule, SignalingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
