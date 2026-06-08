import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  DEFAULT_RATE_LIMIT_CONFIG,
  RATE_LIMIT_CONFIG_TOKEN,
  VALID_SCOPES,
} from './rate-limit.constants';
import type { RateLimitConfig, RateLimitScope } from './rate-limit.constants';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export type RateLimitBackend = Map<string, Map<string, Bucket>>;

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export type Clock = () => number;

const DEFAULT_CLOCK: Clock = () => Date.now();

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly backend: RateLimitBackend;
  private readonly clock: Clock;
  private readonly config: RateLimitConfig;
  private readonly sweepInterval: ReturnType<typeof setInterval> | null;

  constructor(
    @Inject(RATE_LIMIT_CONFIG_TOKEN) config?: RateLimitConfig,
    clock?: Clock,
    backend?: RateLimitBackend,
    sweepIntervalMs?: number,
  ) {
    this.config = config ?? DEFAULT_RATE_LIMIT_CONFIG;
    this.clock = clock ?? DEFAULT_CLOCK;
    this.backend = backend ?? this.createDefaultBackend();
    const interval = sweepIntervalMs ?? 60_000;
    this.sweepInterval = setInterval(() => this.sweep(), interval);
    if (typeof this.sweepInterval.unref === 'function') {
      this.sweepInterval.unref();
    }
  }

  acquire(scope: RateLimitScope, key: string, cost = 1): boolean {
    return this.acquireDetailed(scope, key, cost).allowed;
  }

  acquireDetailed(
    scope: RateLimitScope,
    key: string,
    cost = 1,
  ): RateLimitDecision {
    if (!VALID_SCOPES.includes(scope)) {
      throw new Error(`Unknown rate-limit scope: ${scope}`);
    }
    if (!key || typeof key !== 'string') {
      throw new Error('rate-limit key must be a non-empty string');
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      throw new Error('rate-limit cost must be a positive number');
    }

    const limits = this.limitsFor(scope);
    const bucket = this.getOrCreateBucket(scope, key, limits.capacity);
    const now = this.clock();
    const elapsedSeconds = Math.max(0, (now - bucket.updatedAt) / 1000);
    const refilled = bucket.tokens + elapsedSeconds * limits.ratePerSecond;
    const tokens = Math.min(limits.capacity, refilled);
    bucket.updatedAt = now;

    if (tokens >= cost) {
      bucket.tokens = tokens - cost;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        retryAfterMs: 0,
      };
    }

    bucket.tokens = tokens;
    const deficit = cost - tokens;
    const retryAfterMs = Math.ceil((deficit / limits.ratePerSecond) * 1000);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  reset(scope?: RateLimitScope, key?: string): void {
    if (!scope) {
      this.backend.clear();
      return;
    }
    const scoped = this.backend.get(scope);
    if (!scoped) return;
    if (!key) {
      scoped.clear();
      return;
    }
    scoped.delete(key);
  }

  snapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [scope, buckets] of this.backend.entries()) {
      out[scope] = buckets.size;
    }
    return out;
  }

  onModuleDestroy(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
    }
  }

  private limitsFor(scope: RateLimitScope): {
    capacity: number;
    ratePerSecond: number;
  } {
    switch (scope) {
      case 'socket':
        return {
          capacity: this.config.burstSocket,
          ratePerSecond: this.config.socketPerSecond,
        };
      case 'user':
        return {
          capacity: this.config.burstUser,
          ratePerSecond: this.config.userPerSecond,
        };
      case 'ip':
        return {
          capacity: this.config.burstIp,
          ratePerSecond: this.config.ipPerSecond,
        };
    }
  }

  private getOrCreateBucket(
    scope: RateLimitScope,
    key: string,
    capacity: number,
  ): Bucket {
    let scoped = this.backend.get(scope);
    if (!scoped) {
      scoped = new Map<string, Bucket>();
      this.backend.set(scope, scoped);
    }
    let bucket = scoped.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, updatedAt: this.clock() };
      scoped.set(key, bucket);
    }
    return bucket;
  }

  private sweep(): void {
    const now = this.clock();
    const ttlMs = 5 * 60 * 1000;
    for (const [, buckets] of this.backend.entries()) {
      for (const [key, bucket] of buckets.entries()) {
        if (now - bucket.updatedAt > ttlMs) {
          buckets.delete(key);
        }
      }
    }
  }

  private createDefaultBackend(): RateLimitBackend {
    const out: RateLimitBackend = new Map();
    for (const scope of VALID_SCOPES) {
      out.set(scope, new Map<string, Bucket>());
    }
    return out;
  }
}
