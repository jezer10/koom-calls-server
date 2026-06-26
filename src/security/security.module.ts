import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import {
  parseRateLimitConfig,
  parseTokenTtl,
  RateLimitConfig,
  RATE_LIMIT_CONFIG_TOKEN,
  TOKEN_TTL_TOKEN,
} from './rate-limit.constants';
import { WsAuthMiddleware } from './ws-auth.middleware';
import { AuditLogger } from './audit-logger.service';
import { APP_CONFIG } from '../config/app-config.module';
import type { AppConfig } from '../config/app.config';

@Global()
@Module({
  providers: [
    RateLimitService,
    WsAuthMiddleware,
    AuditLogger,
    {
      provide: RATE_LIMIT_CONFIG_TOKEN,
      inject: [APP_CONFIG],
      useFactory: (appConfig: AppConfig): RateLimitConfig =>
        parseRateLimitConfig({
          RATE_LIMIT_SOCKET_PER_SECOND: appConfig.rateLimit.socketPerSecond,
          RATE_LIMIT_USER_PER_SECOND: appConfig.rateLimit.userPerSecond,
          RATE_LIMIT_IP_PER_SECOND: appConfig.rateLimit.ipPerSecond,
          RATE_LIMIT_SOCKET_BURST: appConfig.rateLimit.socketBurst,
          RATE_LIMIT_USER_BURST: appConfig.rateLimit.userBurst,
          RATE_LIMIT_IP_BURST: appConfig.rateLimit.ipBurst,
        }),
    },
    {
      provide: TOKEN_TTL_TOKEN,
      inject: [APP_CONFIG],
      useFactory: (appConfig: AppConfig): number =>
        parseTokenTtl({
          SFU_TOKEN_TTL_SECONDS: appConfig.security.sfuTokenTtlSeconds,
          TURN_TOKEN_TTL_SECONDS: appConfig.security.turnTokenTtlSeconds,
        }),
    },
  ],
  exports: [
    RateLimitService,
    WsAuthMiddleware,
    AuditLogger,
    RATE_LIMIT_CONFIG_TOKEN,
    TOKEN_TTL_TOKEN,
  ],
})
export class SecurityModule {}
