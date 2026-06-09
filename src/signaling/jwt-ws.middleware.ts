import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type * as Io from 'socket.io';

export const WS_AUTH_FAIL_CLOSE_CODE = 4401;

export interface JwtWsMiddlewareOptions {
  secret: string;
  algorithms?: jwt.Algorithm[];
  userIdClaim?: string;
}

export interface VerifiedHandshake {
  userId: string;
  token: string;
}

@Injectable()
export class JwtWsMiddleware {
  private readonly logger = new Logger(JwtWsMiddleware.name);
  private readonly userIdClaim: string;
  private readonly algorithms: jwt.Algorithm[] | undefined;
  private readonly secret: string;

  constructor(options: JwtWsMiddlewareOptions) {
    this.secret = options.secret;
    this.algorithms = options.algorithms;
    this.userIdClaim = options.userIdClaim ?? 'sub';
  }

  use(socket: Io.Socket, next: (err?: Error) => void): void {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        this.disconnect(socket, 'missing-token');
        return next(new Error('unauthorized'));
      }

      const payload = jwt.verify(token, this.secret, {
        algorithms: this.algorithms,
      });
      const userId = this.extractUserId(payload);
      if (!userId) {
        this.disconnect(socket, 'missing-userId');
        return next(new Error('unauthorized'));
      }

      const data = socket.data as Record<string, unknown>;
      data.userId = userId;
      data.token = token;
      next();
    } catch (err) {
      const reason =
        err instanceof jwt.TokenExpiredError
          ? 'expired'
          : err instanceof jwt.JsonWebTokenError
            ? 'invalid'
            : 'verification-failed';
      this.logger.debug(`rejecting socket ${socket.id}: ${reason}`);
      this.disconnect(socket, reason);
      next(err instanceof Error ? err : new Error('unauthorized'));
    }
  }

  verifyHandshake(socket: Io.Socket): VerifiedHandshake {
    const token = this.extractToken(socket);
    if (!token) {
      throw new Error('missing-token');
    }
    const payload = jwt.verify(token, this.secret, {
      algorithms: this.algorithms,
    });
    const userId = this.extractUserId(payload);
    if (!userId) {
      throw new Error('missing-userId');
    }
    return { userId, token };
  }

  private extractToken(socket: Io.Socket): string | undefined {
    const fromAuth = this.pickToken(
      (socket.handshake?.auth as Record<string, unknown> | undefined)?.token,
    );
    if (fromAuth) return fromAuth;

    const fromHeader = this.pickToken(socket.handshake?.headers?.authorization);
    if (fromHeader) return fromHeader;

    const fromQuery = this.pickToken(socket.handshake?.query?.token);
    return fromQuery ?? undefined;
  }

  private pickToken(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length === 0) return undefined;
    if (value.startsWith('Bearer ')) {
      const token = value.slice('Bearer '.length).trim();
      return token.length > 0 ? token : undefined;
    }
    return value;
  }

  private extractUserId(payload: jwt.JwtPayload | string): string | undefined {
    if (typeof payload === 'string') return undefined;
    const record = payload as Record<string, unknown>;
    const claim = record[this.userIdClaim];
    if (typeof claim === 'string' && claim.length > 0) return claim;
    if (typeof record.sub === 'string' && record.sub.length > 0) {
      return record.sub;
    }
    if (typeof record.userId === 'string' && record.userId.length > 0) {
      return record.userId;
    }
    return undefined;
  }

  private disconnect(socket: Io.Socket, reason: string): void {
    try {
      socket.emit('auth:error', { reason });
    } catch {
      /* swallow */
    }
    try {
      socket.disconnect(true);
    } catch {
      /* swallow */
    }
    void reason;
  }
}

export function defaultJwtSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-jwt-secret';
}

export function createJwtWsMiddleware(
  options?: Partial<JwtWsMiddlewareOptions>,
): JwtWsMiddleware {
  return new JwtWsMiddleware({
    secret: options?.secret ?? defaultJwtSecret(),
    algorithms: options?.algorithms,
    userIdClaim: options?.userIdClaim,
  });
}
