import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
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
