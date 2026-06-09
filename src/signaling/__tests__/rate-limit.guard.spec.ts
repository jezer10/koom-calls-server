import { WsException } from '@nestjs/websockets';
import { ExecutionContext } from '@nestjs/common';
import {
  RateLimitGuard,
  SIGNALING_RATE_LIMIT_DEFAULT,
  SIGNALING_RATE_LIMIT_WINDOW_MS,
} from '../rate-limit.guard';

interface FakeSocket {
  id: string;
  emit: jest.Mock;
}

function makeSocket(id: string): FakeSocket {
  return { id, emit: jest.fn() };
}

function makeExecutionContext(socket: FakeSocket): ExecutionContext {
  return {
    getArgs: () => [socket],
    getArgByIndex: (index: number) => (index === 0 ? socket : undefined),
    switchToRpc: () => ({}) as never,
    switchToHttp: () => ({}) as never,
    switchToWs: () => ({}) as never,
    getClass: () => RateLimitGuard as never,
    getHandler: () => (() => undefined) as never,
    getType: () => 'ws' as never,
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  it('exposes the default capacity of 30 events / second', () => {
    expect(SIGNALING_RATE_LIMIT_DEFAULT).toBe(30);
    expect(SIGNALING_RATE_LIMIT_WINDOW_MS).toBe(1_000);
  });

  describe('tryConsume()', () => {
    it('allows up to the configured capacity within the window', () => {
      const guard = new RateLimitGuard({ capacity: 3, windowMs: 1_000 });
      const t0 = 1_000_000;
      expect(guard.tryConsume('sock-A', t0)).toBe(true);
      expect(guard.tryConsume('sock-A', t0 + 10)).toBe(true);
      expect(guard.tryConsume('sock-A', t0 + 20)).toBe(true);
    });

    it('rejects the (capacity+1)-th event within the window', () => {
      const guard = new RateLimitGuard({ capacity: 3, windowMs: 1_000 });
      const t0 = 2_000_000;
      for (let i = 0; i < 3; i++) {
        expect(guard.tryConsume('sock-A', t0 + i)).toBe(true);
      }
      expect(guard.tryConsume('sock-A', t0 + 30)).toBe(false);
    });

    it('rejects the 31st event in 1 second with default capacity', () => {
      const guard = new RateLimitGuard();
      const t0 = 3_000_000;
      for (let i = 0; i < 30; i++) {
        expect(guard.tryConsume('sock-A', t0 + i)).toBe(true);
      }
      expect(guard.tryConsume('sock-A', t0 + 31)).toBe(false);
    });

    it('refills the bucket after the window elapses', () => {
      const guard = new RateLimitGuard({ capacity: 2, windowMs: 100 });
      const t0 = 4_000_000;
      expect(guard.tryConsume('sock-A', t0)).toBe(true);
      expect(guard.tryConsume('sock-A', t0 + 10)).toBe(true);
      expect(guard.tryConsume('sock-A', t0 + 20)).toBe(false);
      expect(guard.tryConsume('sock-A', t0 + 150)).toBe(true);
    });

    it('tracks buckets per socket independently', () => {
      const guard = new RateLimitGuard({ capacity: 1, windowMs: 1_000 });
      const t0 = 5_000_000;
      expect(guard.tryConsume('sock-A', t0)).toBe(true);
      expect(guard.tryConsume('sock-A', t0 + 10)).toBe(false);
      expect(guard.tryConsume('sock-B', t0 + 20)).toBe(true);
    });
  });

  describe('canActivate()', () => {
    it('returns true when the socket is within the rate limit', () => {
      const guard = new RateLimitGuard({ capacity: 5, windowMs: 1_000 });
      const socket = makeSocket('sock-A');
      expect(guard.canActivate(makeExecutionContext(socket))).toBe(true);
    });

    it('throws WsException("rate-limit") when exceeded', () => {
      const guard = new RateLimitGuard({ capacity: 1, windowMs: 1_000 });
      const socket = makeSocket('sock-A');
      const ctx = makeExecutionContext(socket);
      expect(guard.canActivate(ctx)).toBe(true);
      expect(() => guard.canActivate(ctx)).toThrow(WsException);
      try {
        guard.canActivate(ctx);
      } catch (err) {
        expect(err).toBeInstanceOf(WsException);
        expect((err as WsException).getError()).toBe('rate-limit');
      }
    });

    it('throws when no socket can be extracted from context', () => {
      const guard = new RateLimitGuard();
      const ctx = {
        getArgs: () => [],
        getArgByIndex: () => undefined,
        switchToRpc: () => ({}) as never,
        switchToHttp: () => ({}) as never,
        switchToWs: () => ({}) as never,
        getClass: () => RateLimitGuard as never,
        getHandler: () => (() => undefined) as never,
        getType: () => 'ws' as never,
      } as unknown as ExecutionContext;
      expect(() => guard.canActivate(ctx)).toThrow(WsException);
    });
  });

  describe('reset()', () => {
    it('clears all buckets', () => {
      const guard = new RateLimitGuard({ capacity: 1, windowMs: 1_000 });
      expect(guard.tryConsume('sock-A', 0)).toBe(true);
      expect(guard.tryConsume('sock-A', 1)).toBe(false);
      guard.reset();
      expect(guard.tryConsume('sock-A', 2)).toBe(true);
      expect(guard.snapshotForTests().size).toBe(1);
    });
  });
});
