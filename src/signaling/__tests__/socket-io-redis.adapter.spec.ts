import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server as IoServer } from 'socket.io';
import { SocketIoRedisAdapter } from '../socket-io-redis.adapter';
import * as IORedis from 'ioredis';

jest.mock('@nestjs/platform-socket.io', () => {
  return {
    IoAdapter: class FakeIoAdapter {
      createIOServer(): IoServer {
        return undefined as unknown as IoServer;
      }
    },
  };
});

interface FakeRedisInstance {
  __isRedisClient: boolean;
  kind: string;
  duplicate: jest.Mock;
}

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn(),
  };
});

const createAdapterSpy = jest.fn().mockReturnValue(jest.fn());
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: (...args: unknown[]): unknown => {
    createAdapterSpy(...args);
    return jest.fn();
  },
}));

describe('SocketIoRedisAdapter', () => {
  const ORIGINAL_REDIS_URL = process.env.REDIS_URL;
  let RedisMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    RedisMock = (IORedis as unknown as { Redis: jest.Mock }).Redis;
    RedisMock.mockImplementation((): FakeRedisInstance => {
      const instance: FakeRedisInstance = {
        __isRedisClient: true,
        kind: 'redis',
        duplicate: jest.fn().mockImplementation(
          (): FakeRedisInstance => ({
            __isRedisClient: true,
            kind: 'redis-sub',
            duplicate: jest.fn(),
          }),
        ),
      };
      return instance;
    });
    delete process.env.REDIS_URL;
  });

  afterAll(() => {
    if (ORIGINAL_REDIS_URL === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = ORIGINAL_REDIS_URL;
    }
  });

  function buildAdapter(options?: { redisUrl?: string }): SocketIoRedisAdapter {
    return new SocketIoRedisAdapter({}, options);
  }

  function buildServerDouble(): {
    server: IoServer;
    adapter: jest.Mock;
  } {
    const adapter = jest.fn();
    const server = { adapter } as unknown as IoServer;
    return { server, adapter };
  }

  function spyOnSuper(server: IoServer): jest.SpyInstance {
    const proto = Object.getPrototypeOf(
      Object.getPrototypeOf(new SocketIoRedisAdapter({})),
    ) as { createIOServer: () => IoServer };
    return jest.spyOn(proto, 'createIOServer').mockReturnValue(server);
  }

  it('extends IoAdapter from @nestjs/platform-socket.io', () => {
    const adapter = new SocketIoRedisAdapter({});
    expect(adapter).toBeInstanceOf(IoAdapter);
  });

  it('returns the plain io server (no redis adapter) when REDIS_URL is not set', () => {
    const adapter = buildAdapter();
    const { server, adapter: adapterFn } = buildServerDouble();
    const superSpy = spyOnSuper(server);

    const result = adapter.createIOServer(0);

    expect(superSpy).toHaveBeenCalledWith(0, undefined);
    expect(result).toBe(server);
    expect(adapterFn).not.toHaveBeenCalled();
    expect(RedisMock).not.toHaveBeenCalled();
    expect(createAdapterSpy).not.toHaveBeenCalled();

    superSpy.mockRestore();
  });

  it('attaches a redis adapter when REDIS_URL is provided via constructor options', () => {
    const pubInstance: FakeRedisInstance = {
      __isRedisClient: true,
      kind: 'pub',
      duplicate: jest.fn(),
    };
    RedisMock.mockImplementationOnce((): FakeRedisInstance => pubInstance);

    const adapter = buildAdapter({ redisUrl: 'redis://localhost:6379' });
    const { server, adapter: adapterFn } = buildServerDouble();
    const superSpy = spyOnSuper(server);

    const result = adapter.createIOServer(0, { path: '/socket.io' });

    expect(superSpy).toHaveBeenCalledWith(0, { path: '/socket.io' });
    expect(result).toBe(server);
    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(RedisMock).toHaveBeenCalledWith('redis://localhost:6379');
    expect(pubInstance.duplicate).toHaveBeenCalledTimes(1);
    expect(createAdapterSpy).toHaveBeenCalledTimes(1);
    expect(adapterFn).toHaveBeenCalledTimes(1);
    expect(adapterFn).toHaveBeenCalledWith(expect.any(Function));

    superSpy.mockRestore();
  });

  it('attaches a redis adapter when REDIS_URL is provided via env', () => {
    process.env.REDIS_URL = 'redis://from-env:6379';
    const adapter = buildAdapter();
    const { server, adapter: adapterFn } = buildServerDouble();
    const superSpy = spyOnSuper(server);

    adapter.createIOServer(0);

    expect(RedisMock).toHaveBeenCalledWith('redis://from-env:6379');
    expect(adapterFn).toHaveBeenCalledTimes(1);

    superSpy.mockRestore();
  });

  it('uses two distinct ioredis instances for pub and sub', () => {
    const pubInstance: FakeRedisInstance = {
      __isRedisClient: true,
      kind: 'pub',
      duplicate: jest.fn(),
    };
    const subInstance: FakeRedisInstance = {
      __isRedisClient: true,
      kind: 'sub',
      duplicate: jest.fn(),
    };
    pubInstance.duplicate.mockReturnValue(subInstance);
    RedisMock.mockImplementationOnce((): FakeRedisInstance => pubInstance);

    const adapter = buildAdapter({ redisUrl: 'redis://localhost:6379' });
    const { server, adapter: adapterFn } = buildServerDouble();
    const superSpy = spyOnSuper(server);

    adapter.createIOServer(0);

    expect(pubInstance.duplicate).toHaveBeenCalledTimes(1);
    expect(createAdapterSpy).toHaveBeenCalledWith(pubInstance, subInstance);
    expect(adapterFn).toHaveBeenCalledWith(expect.any(Function));

    superSpy.mockRestore();
  });
});
