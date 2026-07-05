import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserEntity } from './auth/entities/user.entity';
import { Init1781655355076 } from './persistence/migrations/1781655355076-init';
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
import { envValidationSchema } from './config/env.schema';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import googleConfig from './config/google.config';
import livekitConfig from './config/livekit.config';
import presenceConfig from './config/presence.config';
import rateLimitConfig from './config/rate-limit.config';
import redisConfig from './config/redis.config';
import securityConfig from './config/security.config';
import signalingConfig from './config/signaling.config';
import turnConfig from './config/turn.config';

export { SocketIoRedisAdapter };

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        googleConfig,
        livekitConfig,
        presenceConfig,
        rateLimitConfig,
        redisConfig,
        securityConfig,
        signalingConfig,
        turnConfig,
      ],
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        return {
          type: 'postgres' as const,
          url: cfg.getOrThrow<string>('database.url'),
          entities: [UserEntity],
          migrations: [Init1781655355076],
          synchronize: false,
          migrationsRun: true,
          ssl: cfg.get<boolean>('database.ssl')
            ? { rejectUnauthorized: false }
            : false,
        };
      },
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
