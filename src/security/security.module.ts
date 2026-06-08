import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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
      useFactory: (): RateLimitConfig => parseRateLimitConfig(process.env),
    },
    {
      provide: TOKEN_TTL_TOKEN,
      useFactory: (): number => parseTokenTtl(process.env),
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
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(WsAuthMiddleware).forRoutes('*');
  }
}
