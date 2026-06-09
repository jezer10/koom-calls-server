import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PresenceService, resolvePresenceTtl } from './presence.service';

const USER_KEY_PREFIX = 'presence:user:';
const USER_SOCKET_KEY_PREFIX = 'presence:user-socket:';
const CALL_KEY_PREFIX = 'presence:call:';

function userKey(userId: string): string {
  return `${USER_KEY_PREFIX}${userId}`;
}

function userSocketKey(userId: string, socketId: string): string {
  return `${USER_SOCKET_KEY_PREFIX}${userId}:${socketId}`;
}

function callKey(callId: string): string {
  return `${CALL_KEY_PREFIX}${callId}`;
}

@Injectable()
export class RedisPresenceService implements PresenceService, OnModuleDestroy {
  private readonly defaultTtlSeconds: number;

  constructor(
    private readonly redis: Redis,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.defaultTtlSeconds = resolvePresenceTtl(env);
  }

  async markOnline(
    userId: string,
    socketId: string,
    ttlSeconds?: number,
  ): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const uKey = userKey(userId);
    const sKey = userSocketKey(userId, socketId);
    await this.redis
      .multi()
      .sadd(uKey, socketId)
      .expire(uKey, ttl)
      .set(sKey, '1', 'EX', ttl)
      .exec();
  }

  async markOffline(userId: string, socketId: string): Promise<void> {
    const uKey = userKey(userId);
    const sKey = userSocketKey(userId, socketId);
    await this.redis.multi().srem(uKey, socketId).del(sKey).exec();
    // If the bucket is empty we let the existing TTL take care of GC.
  }

  async whoIsOnline(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const keys = userIds.map(userKey);
    const counts = await this.redis
      .pipeline()
      .exists(...keys)
      .exec();
    const online = new Set<string>();
    if (!counts) return online;
    counts.forEach((entry, idx) => {
      const value = entry?.[1];
      if (typeof value === 'number' && value > 0) {
        const id = userIds[idx];
        if (id !== undefined) online.add(id);
      }
    });
    return online;
  }

  async trackCall(
    callId: string,
    socketId: string,
    ttlSeconds?: number,
  ): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const cKey = callKey(callId);
    await this.redis.multi().sadd(cKey, socketId).expire(cKey, ttl).exec();
  }

  async untrackCall(callId: string, socketId: string): Promise<void> {
    await this.redis.srem(callKey(callId), socketId);
  }

  async callSockets(callId: string): Promise<Set<string>> {
    const members = await this.redis.smembers(callKey(callId));
    return new Set(members);
  }

  async socketsForUser(userId: string): Promise<Set<string>> {
    const members = await this.redis.smembers(userKey(userId));
    return new Set(members);
  }

  onModuleDestroy(): void {
    if (this.redis.status !== 'end') {
      void this.redis.quit().catch(() => {
        try {
          this.redis.disconnect();
        } catch {
          // best-effort
        }
      });
    }
  }
}
