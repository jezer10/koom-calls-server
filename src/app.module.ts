import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SignalingModule } from './signaling/signaling.module';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';

@Module({
  imports: [SignalingModule, AuthModule, CallsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
