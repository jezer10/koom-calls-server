import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
  [k: string]: unknown;
}

export interface JwtUser {
  userId: string;
  email?: string;
  sub: string;
  iat?: number;
  exp?: number;
  [k: string]: unknown;
}

export const JWT_SECRET_ENV = 'JWT_SECRET';

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env[JWT_SECRET_ENV];
  if (typeof secret !== 'string' || secret === '') {
    throw new Error(
      `${JWT_SECRET_ENV} environment variable is required for the JWT strategy`,
    );
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    let secret: string;
    try {
      secret = resolveJwtSecret();
    } catch {
      secret = 'dev-secret-change-me';
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): JwtUser {
    if (!payload || typeof payload.sub !== 'string' || payload.sub === '') {
      throw new UnauthorizedException('invalid token payload');
    }
    return {
      ...payload,
      sub: payload.sub,
      userId: payload.sub,
      email: payload.email,
    };
  }
}
