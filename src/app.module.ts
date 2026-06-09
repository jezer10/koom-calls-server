import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { SignalingModule } from './signaling/signaling.module';
import { PresenceModule } from './presence/presence.module';
import { MediaProviderModule } from './media-provider/media-provider.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ObservabilityModule } from './observability/observability.module';
import { TurnModule } from './turn/turn.module';
import { SfuModule } from './sfu/sfu.module';
import { SecurityModule } from './security/security.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import {
  SignalingAdapterModule,
  SocketIoRedisAdapter,
} from './signaling/signaling.adapter.module';
import { parseEnv } from './config/env.schema';

export { SocketIoRedisAdapter };

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: (env) => parseEnv(env, { onWarning: console.warn }),
    }),
    AuthModule,
    CallsModule,
    SignalingModule,
    SignalingAdapterModule,
    PresenceModule,
    MediaProviderModule,
    NotificationsModule,
    ObservabilityModule,
    TurnModule,
    SfuModule,
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
