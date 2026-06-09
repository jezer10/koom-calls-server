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
      useFactory: (configService: ConfigService): RateLimitConfig =>
        parseRateLimitConfig({
          RATE_LIMIT_SOCKET_PER_SECOND: configService.getOrThrow<number>(
            'RATE_LIMIT_SOCKET_PER_SECOND',
          ),
          RATE_LIMIT_USER_PER_SECOND: configService.getOrThrow<number>(
            'RATE_LIMIT_USER_PER_SECOND',
          ),
          RATE_LIMIT_IP_PER_SECOND: configService.getOrThrow<number>(
            'RATE_LIMIT_IP_PER_SECOND',
          ),
          RATE_LIMIT_SOCKET_BURST: configService.getOrThrow<number>(
            'RATE_LIMIT_SOCKET_BURST',
          ),
          RATE_LIMIT_USER_BURST: configService.getOrThrow<number>(
            'RATE_LIMIT_USER_BURST',
          ),
          RATE_LIMIT_IP_BURST: configService.getOrThrow<number>(
            'RATE_LIMIT_IP_BURST',
          ),
        }),
    },
    {
      provide: TOKEN_TTL_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): number =>
        parseTokenTtl({
          SFU_TOKEN_TTL_SECONDS: configService.get<number>(
            'SFU_TOKEN_TTL_SECONDS',
          ),
          TURN_TOKEN_TTL_SECONDS: configService.get<number>(
            'TURN_TOKEN_TTL_SECONDS',
          ),
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
