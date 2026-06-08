import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { ParticipantsModule } from './participants/participants.module';
import { PersistenceModule } from './persistence/persistence.module';
import { SignalingModule } from './signaling/signaling.module';

@Module({
  imports: [
    PersistenceModule,
    AuthModule,
    CallsModule,
    ParticipantsModule,
    SignalingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
