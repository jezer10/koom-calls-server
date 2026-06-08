import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SignalingModule } from './signaling/signaling.module';
import { CallsModule } from './calls/calls.module';

@Module({
  imports: [SignalingModule, CallsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
