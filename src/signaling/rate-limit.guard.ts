import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type * as Io from 'socket.io';

export const SIGNALING_RATE_LIMIT_DEFAULT = 30;
export const SIGNALING_RATE_LIMIT_WINDOW_MS = 1_000;

export interface TokenBucket {
  tokens: number;
  refilledAt: number;
}

export interface RateLimitOptions {
  capacity: number;
  windowMs: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly options: RateLimitOptions;
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(options?: Partial<RateLimitOptions>) {
    this.options = {
      capacity: options?.capacity ?? SIGNALING_RATE_LIMIT_DEFAULT,
      windowMs: options?.windowMs ?? SIGNALING_RATE_LIMIT_WINDOW_MS,
    };
  }

  canActivate(context: ExecutionContext): boolean {
    const client = this.extractSocket(context);
    if (!client) {
      throw new WsException('rate-limit: no client context');
    }

    if (!this.tryConsume(client.id)) {
      throw new WsException('rate-limit');
    }
    return true;
  }

  tryConsume(socketId: string, now: number = Date.now()): boolean {
    const bucket = this.buckets.get(socketId);
    if (!bucket) {
      this.buckets.set(socketId, {
        tokens: this.options.capacity - 1,
        refilledAt: now,
      });
      return true;
    }

    const elapsed = now - bucket.refilledAt;
    if (elapsed >= this.options.windowMs) {
      bucket.tokens = this.options.capacity - 1;
      bucket.refilledAt = now;
      return true;
    }

    if (bucket.tokens <= 0) {
      return false;
    }
    bucket.tokens -= 1;
    return true;
  }

  reset(): void {
    this.buckets.clear();
  }

  snapshotForTests(): Map<string, TokenBucket> {
    return new Map(this.buckets);
  }

  protected extractSocket(context: ExecutionContext): Io.Socket | undefined {
    const args = context.getArgs();
    for (const arg of args) {
      if (this.isSocket(arg)) return arg;
    }
    return undefined;
  }

  private isSocket(value: unknown): value is Io.Socket {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { id?: unknown; emit?: unknown };
    return (
      typeof candidate.id === 'string' && typeof candidate.emit === 'function'
    );
  }
}
