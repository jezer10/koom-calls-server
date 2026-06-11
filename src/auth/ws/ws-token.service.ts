import { Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';

export interface WsTokenPayload {
  sub: string;
  ws: true;
  jti: string;
  iat: number;
  exp: number;
}

export interface WsTokenResult {
  token: string;
  expiresAt: number;
}

const DEFAULT_TTL_SECONDS = 60;
const SWEEP_INTERVAL_MS = 30_000;

@Injectable()
export class WsTokenService implements OnModuleDestroy {
  private readonly used = new Map<string, number>();
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(private readonly jwt: JwtService) {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  issue(userId: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): WsTokenResult {
    const jti = randomBytes(16).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const exp = now + ttlSeconds;
    const token = this.jwt.sign(
      { sub: userId, ws: true, jti },
      { expiresIn: ttlSeconds },
    );
    this.used.set(jti, exp);
    return { token, expiresAt: exp * 1000 };
  }

  consume(token: string): string {
    let payload: WsTokenPayload;
    try {
      payload = this.jwt.verify<WsTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('invalid ws token');
    }
    if (payload.ws !== true) {
      throw new UnauthorizedException('not a ws token');
    }
    if (!payload.jti) {
      throw new UnauthorizedException('ws token missing jti');
    }
    const exp = this.used.get(payload.jti);
    if (exp === undefined) {
      throw new UnauthorizedException('ws token not found or already used');
    }
    this.used.delete(payload.jti);
    return payload.sub;
  }

  private sweep(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of this.used) {
      if (exp <= now) this.used.delete(jti);
    }
  }
}
