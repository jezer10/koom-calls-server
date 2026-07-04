import { Redis } from 'ioredis';

export type RedisLike = Redis;

export interface CreateRedisClientOptions {
  url?: string;
  onError?: (err: Error) => void;
}

export function createRedisClient(
  options: CreateRedisClientOptions = {},
): Redis {
  const url = options.url;
  if (!url) {
    throw new Error('createRedisClient requires a non-empty Redis URL');
  }

  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  if (options.onError) {
    client.on('error', (err) => options.onError?.(err));
  } else {
    client.on('error', (err) => {
      // Surface in logs but don't crash the process; gateway layer can recover.

      console.error('[presence] redis error', err.message);
    });
  }

  return client;
}

export async function canConnectRedis(url: string): Promise<boolean> {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });

  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}
