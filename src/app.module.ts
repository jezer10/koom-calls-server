import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { ParticipantsModule } from './participants/participants.module';
import { PersistenceModule } from './persistence/persistence.module';
import { SignalingModule } from './signaling/signaling.module';
import { PresenceModule } from './presence/presence.module';
import { MediaProviderModule } from './media-provider/media-provider.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ObservabilityModule } from './observability/observability.module';
import { TurnModule } from './turn/turn.module';
import { SecurityModule } from './security/security.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import {
  SignalingAdapterModule,
  SocketIoRedisAdapter,
} from './signaling/signaling.adapter.module';

export { SocketIoRedisAdapter };

@Module({
  imports: [
    PersistenceModule,
    AuthModule,
    CallsModule,
    ParticipantsModule,
    SignalingModule,
    SignalingAdapterModule,
    PresenceModule,
    MediaProviderModule,
    NotificationsModule,
    ObservabilityModule,
    TurnModule,
    SecurityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SocketIoRedisAdapter,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [SocketIoRedisAdapter],
})
export class AppModule {}
