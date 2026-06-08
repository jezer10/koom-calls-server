import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { ParticipantsModule } from './participants/participants.module';
import { SignalingModule } from './signaling/signaling.module';
import { PresenceModule } from './presence/presence.module';
import { MediaProviderModule } from './media-provider/media-provider.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ObservabilityModule } from './observability/observability.module';
import { PersistenceModule } from './persistence/persistence.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    AuthModule,
    CallsModule,
    ParticipantsModule,
    SignalingModule,
    PresenceModule,
    MediaProviderModule,
    NotificationsModule,
    ObservabilityModule,
    PersistenceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
