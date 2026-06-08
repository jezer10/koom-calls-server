import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { loadConfig } from '../config/app.config';
import { AuthenticatedUser } from './authenticated-user';

interface JwtPayload {
  sub: string;
  iss?: string;
  exp?: number;
  iat?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly config = loadConfig();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthenticatedUser;
    }>();
    const header = request.headers.authorization;
    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Authorization header must be: Bearer <token>',
      );
    }
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, this.config.jwt.secret, {
        algorithms: ['HS256'],
        issuer: this.config.jwt.issuer,
      }) as JwtPayload;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      throw new UnauthorizedException(`Invalid JWT: ${message}`);
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('JWT missing sub claim');
    }
    request.user = { userId: payload.sub };
    return true;
  }
}
