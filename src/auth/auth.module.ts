import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthAuditLogger } from './auth-audit.logger';
import { UserEntity } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { GoogleService } from './providers/google/google.service';
import { OAuthProvidersRegistry } from './providers/oauth-providers.registry';
import { WsTokenService } from './ws/ws-token.service';
import {
  OAUTH_PROVIDERS,
  type OAuthProvidersMap,
} from './providers/oauth-provider.interface';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('auth.secret'),
        signOptions: {
          expiresIn: (cfg.get<string>('auth.ttl') ?? '1h') as never,
        },
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 10 }]),
    TypeOrmModule.forFeature([UserEntity]),
  ],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    AuthService,
    AuthAuditLogger,
    UsersRepository,
    GoogleService,
    OAuthProvidersRegistry,
    WsTokenService,
    {
      provide: OAUTH_PROVIDERS,
      inject: [GoogleService],
      useFactory: (google: GoogleService): OAuthProvidersMap => {
        const map: OAuthProvidersMap = new Map();
        map.set(google.meta.name, google);
        return map;
      },
    },
  ],
  controllers: [AuthController],
  exports: [
    JwtAuthGuard,
    JwtModule,
    PassportModule,
    AuthService,
    WsTokenService,
  ],
})
export class AuthModule {}
