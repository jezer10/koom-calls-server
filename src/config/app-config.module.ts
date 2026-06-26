import { Global, Module } from '@nestjs/common';
import {
  buildAppConfig,
  type AppConfig,
  type GoogleConfig,
  type LiveKitConfig,
  type RedisConfig,
  type PresenceConfig,
  type RateLimitConfig,
  type SecurityConfig,
} from './app.config';
import { parseEnv } from './env.schema';

export const APP_CONFIG = 'APP_CONFIG';
export const LIVEKIT_CONFIG = 'LIVEKIT_CONFIG';
export const GOOGLE_CONFIG = 'GOOGLE_CONFIG';
export const REDIS_CONFIG = 'REDIS_CONFIG';
export const PRESENCE_CONFIG = 'PRESENCE_CONFIG';
export const RATE_LIMIT_APP_CONFIG = 'RATE_LIMIT_APP_CONFIG';
export const SECURITY_APP_CONFIG = 'SECURITY_APP_CONFIG';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig =>
        buildAppConfig(parseEnv(process.env), process.env),
    },
    {
      provide: LIVEKIT_CONFIG,
      useFactory: (cfg: AppConfig): LiveKitConfig => cfg.livekit,
      inject: [APP_CONFIG],
    },
    {
      provide: GOOGLE_CONFIG,
      useFactory: (cfg: AppConfig): GoogleConfig => cfg.google,
      inject: [APP_CONFIG],
    },
    {
      provide: REDIS_CONFIG,
      useFactory: (cfg: AppConfig): RedisConfig => cfg.redis,
      inject: [APP_CONFIG],
    },
    {
      provide: PRESENCE_CONFIG,
      useFactory: (cfg: AppConfig): PresenceConfig => cfg.presence,
      inject: [APP_CONFIG],
    },
    {
      provide: RATE_LIMIT_APP_CONFIG,
      useFactory: (cfg: AppConfig): RateLimitConfig => cfg.rateLimit,
      inject: [APP_CONFIG],
    },
    {
      provide: SECURITY_APP_CONFIG,
      useFactory: (cfg: AppConfig): SecurityConfig => cfg.security,
      inject: [APP_CONFIG],
    },
  ],
  exports: [
    APP_CONFIG,
    LIVEKIT_CONFIG,
    GOOGLE_CONFIG,
    REDIS_CONFIG,
    PRESENCE_CONFIG,
    RATE_LIMIT_APP_CONFIG,
    SECURITY_APP_CONFIG,
  ],
})
export class AppConfigModule {}
