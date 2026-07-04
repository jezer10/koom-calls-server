import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('auth.secret'),
        signOptions: { expiresIn: (cfg.get<string>('auth.ttl') ?? '1h') as never },
      }),
    }),
  ],
  exports: [AuthModule, JwtModule],
})
export class AppJwtModule {}
