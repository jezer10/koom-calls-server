import { Module } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { WsJwtGuard } from './ws-jwt.guard';

@Module({
  providers: [JwtStrategy, JwtAuthGuard, WsJwtGuard],
  exports: [JwtAuthGuard, WsJwtGuard, JwtStrategy],
})
export class AuthModule {}
