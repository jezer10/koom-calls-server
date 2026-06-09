import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { loadConfig } from '../config/app.config';

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface AuthenticatedUser {
  id: string;
  payload: JwtPayload;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const jwt = loadConfig().jwt;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.secret,
      audience: jwt.audience,
      issuer: jwt.issuer,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0
    ) {
      throw new UnauthorizedException('Invalid token: missing subject');
    }
    return { id: payload.sub, payload };
  }
}
