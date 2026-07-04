import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Global()
@Module({
  providers: [
    RateLimitService,
    WsAuthMiddleware,
    AuditLogger,
    {
      provide: RATE_LIMIT_CONFIG_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RateLimitConfig =>
        parseRateLimitConfig({
          RATE_LIMIT_SOCKET_PER_SECOND:
            config.get<number>('rateLimit.socketPerSecond') ?? 20,
          RATE_LIMIT_USER_PER_SECOND:
            config.get<number>('rateLimit.userPerSecond') ?? 10,
          RATE_LIMIT_IP_PER_SECOND:
            config.get<number>('rateLimit.ipPerSecond') ?? 30,
          RATE_LIMIT_SOCKET_BURST:
            config.get<number>('rateLimit.socketBurst') ?? 5,
          RATE_LIMIT_USER_BURST:
            config.get<number>('rateLimit.userBurst') ?? 3,
          RATE_LIMIT_IP_BURST: config.get<number>('rateLimit.ipBurst') ?? 8,
        }),
    },
    {
      provide: TOKEN_TTL_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): number =>
        parseTokenTtl({
          SFU_TOKEN_TTL_SECONDS:
            config.get<number>('security.sfuTokenTtlSeconds') ?? 3600,
          TURN_TOKEN_TTL_SECONDS:
            config.get<number>('security.turnTokenTtlSeconds') ?? 3600,
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
