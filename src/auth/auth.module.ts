import { Module, Global } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}

export { JwtAuthGuard } from './jwt-auth.guard';
export type { AuthenticatedUser, RequestUser } from './authenticated-user';
