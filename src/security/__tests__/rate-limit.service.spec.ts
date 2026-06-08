import { RateLimitService } from '../rate-limit.service';
import {
  DEFAULT_RATE_LIMIT_CONFIG,
  RateLimitScope,
} from '../rate-limit.constants';
import type { RateLimitBackend, Clock } from '../rate-limit.service';

function makeService(opts: {
  clock?: Clock;
  backend?: RateLimitBackend;
  config?: typeof DEFAULT_RATE_LIMIT_CONFIG;
  sweepIntervalMs?: number;
}) {
  return new RateLimitService(
    opts.config ?? DEFAULT_RATE_LIMIT_CONFIG,
    opts.clock,
    opts.backend,
    opts.sweepIntervalMs,
  );
}

describe('RateLimitService', () => {
  let now: number;
  let clock: Clock;
  let backend: RateLimitBackend;
  let service: RateLimitService;

  beforeEach(() => {
    now = 1_000_000;
    clock = () => now;
    backend = new Map();
    for (const scope of ['socket', 'user', 'ip'] as RateLimitScope[]) {
      backend.set(scope, new Map());
    }
    service = makeService({ clock, backend, sweepIntervalMs: 0 });
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('socket scope (default 30/s, burst 30)', () => {
    it('first 30 acquires return true', () => {
      let allowed = 0;
      for (let i = 0; i < 30; i++) {
        if (service.acquire('socket', 'sock-1')) allowed++;
      }
      expect(allowed).toBe(30);
    });

    it('31st acquire returns false', () => {
      for (let i = 0; i < 30; i++) service.acquire('socket', 'sock-1');
      expect(service.acquire('socket', 'sock-1')).toBe(false);
    });

    it('after 1s, tokens refill', () => {
      for (let i = 0; i < 30; i++) service.acquire('socket', 'sock-1');
      expect(service.acquire('socket', 'sock-1')).toBe(false);
      now += 1000;
      expect(service.acquire('socket', 'sock-1')).toBe(true);
    });

    it('caps at burst capacity even after long idle', () => {
      for (let i = 0; i < 30; i++) service.acquire('socket', 'sock-1');
      now += 60_000;
      let allowed = 0;
      for (let i = 0; i < 60; i++) {
        if (service.acquire('socket', 'sock-1')) allowed++;
      }
      expect(allowed).toBe(30);
    });
  });

  describe('scope isolation', () => {
    it('per-scope isolation: socket and user buckets are independent', () => {
      for (let i = 0; i < 30; i++) service.acquire('socket', 'k');
      expect(service.acquire('socket', 'k')).toBe(false);
      for (let i = 0; i < 100; i++) service.acquire('user', 'k');
      expect(service.acquire('user', 'k')).toBe(false);
      expect(service.acquire('ip', 'k')).toBe(true);
    });

    it('per-key isolation: same scope, different keys', () => {
      for (let i = 0; i < 30; i++) service.acquire('socket', 'a');
      expect(service.acquire('socket', 'a')).toBe(false);
      expect(service.acquire('socket', 'b')).toBe(true);
    });
  });

  describe('acquireDetailed()', () => {
    it('returns remaining and zero retryAfter when allowed', () => {
      const decision = service.acquireDetailed('socket', 'k', 1);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(29);
      expect(decision.retryAfterMs).toBe(0);
    });

    it('returns retryAfterMs when denied', () => {
      for (let i = 0; i < 30; i++) service.acquire('socket', 'k');
      const decision = service.acquireDetailed('socket', 'k', 1);
      expect(decision.allowed).toBe(false);
      expect(decision.retryAfterMs).toBeGreaterThan(0);
    });

    it('handles cost > 1', () => {
      const decision = service.acquireDetailed('socket', 'k', 5);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(25);
    });
  });

  describe('reset()', () => {
    it('clears a specific key', () => {
      for (let i = 0; i < 30; i++) service.acquire('socket', 'a');
      service.reset('socket', 'a');
      expect(service.acquire('socket', 'a')).toBe(true);
    });

    it('clears a whole scope', () => {
      for (let i = 0; i < 30; i++) service.acquire('socket', 'a');
      for (let i = 0; i < 30; i++) service.acquire('socket', 'b');
      service.reset('socket');
      expect(service.acquire('socket', 'a')).toBe(true);
      expect(service.acquire('socket', 'b')).toBe(true);
    });

    it('clears everything when called with no args', () => {
      for (let i = 0; i < 30; i++) service.acquire('socket', 'a');
      for (let i = 0; i < 30; i++) service.acquire('user', 'b');
      service.reset();
      expect(service.acquire('socket', 'a')).toBe(true);
      expect(service.acquire('user', 'b')).toBe(true);
    });
  });

  describe('input validation', () => {
    it('rejects unknown scopes', () => {
      expect(() =>
        service.acquire('banana' as unknown as RateLimitScope, 'k'),
      ).toThrow(/Unknown rate-limit scope/);
    });

    it('rejects empty keys', () => {
      expect(() => service.acquire('socket', '')).toThrow(/non-empty string/);
    });

    it('rejects non-positive cost', () => {
      expect(() => service.acquire('socket', 'k', 0)).toThrow(/positive/);
      expect(() => service.acquire('socket', 'k', -1)).toThrow(/positive/);
    });
  });

  describe('snapshot()', () => {
    it('returns per-scope bucket counts', () => {
      service.acquire('socket', 'a');
      service.acquire('socket', 'b');
      service.acquire('user', 'c');
      expect(service.snapshot()).toEqual({ socket: 2, user: 1, ip: 0 });
    });
  });

  describe('configurable limits', () => {
    it('honors a custom config', () => {
      const custom = {
        ...DEFAULT_RATE_LIMIT_CONFIG,
        socketPerSecond: 5,
        burstSocket: 5,
      };
      const svc = makeService({
        clock,
        backend,
        config: custom,
        sweepIntervalMs: 0,
      });
      try {
        let allowed = 0;
        for (let i = 0; i < 10; i++) {
          if (svc.acquire('socket', 'k')) allowed++;
        }
        expect(allowed).toBe(5);
        now += 1000;
        let allowedAfterRefill = 0;
        for (let i = 0; i < 6; i++) {
          if (svc.acquire('socket', 'k')) allowedAfterRefill++;
        }
        expect(allowedAfterRefill).toBe(5);
      } finally {
        svc.onModuleDestroy();
      }
    });
  });
});
