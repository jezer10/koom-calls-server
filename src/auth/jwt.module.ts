import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    AuthModule,
    JwtModule.register({
      secret: process.env['JWT_SECRET'] ?? 'koom-dev-secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  exports: [AuthModule, JwtModule],
})
export class AppJwtModule {}
