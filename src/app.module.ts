import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserEntity } from './auth/entities/user.entity';
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

function isSqlite(url: string): boolean {
  return url.startsWith('sqlite');
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => parseEnv(env, { onWarning: console.warn }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const url = cfg.getOrThrow<string>('DATABASE_URL');
        const isDev = cfg.get<string>('NODE_ENV') !== 'production';
        if (isSqlite(url)) {
          return {
            type: 'better-sqlite3' as const,
            database: url === 'sqlite::memory:' ? ':memory:' : url.replace(/^sqlite:/, ''),
            autoSave: false,
            entities: [UserEntity],
            synchronize: isDev,
          };
        }
        return {
          type: 'postgres' as const,
          url,
          entities: [UserEntity],
          synchronize: isDev,
          ssl: cfg.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
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
