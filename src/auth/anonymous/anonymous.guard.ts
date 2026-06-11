import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnonymousLoginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const flag = this.config.get<string>('AUTH_ANONYMOUS_LOGIN_ENABLED');
    if (flag === undefined || flag === null || flag === '') {
      return this.config.get<string>('NODE_ENV') !== 'production';
    }
    const enabled = flag === 'true' || flag === '1';
    if (!enabled) {
      throw new NotFoundException('anonymous login is disabled');
    }
    return true;
  }
}
