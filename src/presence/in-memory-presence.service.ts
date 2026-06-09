import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PresenceService, resolvePresenceTtl } from './presence.service';

interface TtlEntry {
  timer: NodeJS.Timeout;
  expiresAt: number;
}

@Injectable()
export class InMemoryPresenceService
  implements PresenceService, OnModuleDestroy
{
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly callBuckets = new Map<string, Set<string>>();
  private readonly userTtl = new Map<string, TtlEntry>();
  private readonly callTtl = new Map<string, TtlEntry>();
  private readonly defaultTtlSeconds: number;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.defaultTtlSeconds = resolvePresenceTtl(env);
  }

  markOnline(
    userId: string,
    socketId: string,
    ttlSeconds?: number,
  ): Promise<void> {
    const bucket = this.userSockets.get(userId) ?? new Set<string>();
    bucket.add(socketId);
    this.userSockets.set(userId, bucket);
    this.refreshUserTtl(userId, ttlSeconds ?? this.defaultTtlSeconds);
    return Promise.resolve();
  }

  markOffline(userId: string, socketId: string): Promise<void> {
    const bucket = this.userSockets.get(userId);
    if (!bucket) return Promise.resolve();
    bucket.delete(socketId);
    if (bucket.size === 0) {
      this.userSockets.delete(userId);
      this.clearUserTtl(userId);
    }
    return Promise.resolve();
  }

  whoIsOnline(userIds: string[]): Promise<Set<string>> {
    const online = new Set<string>();
    for (const id of userIds) {
      const bucket = this.userSockets.get(id);
      if (bucket && bucket.size > 0) online.add(id);
    }
    return Promise.resolve(online);
  }

  trackCall(
    callId: string,
    socketId: string,
    ttlSeconds?: number,
  ): Promise<void> {
    const bucket = this.callBuckets.get(callId) ?? new Set<string>();
    bucket.add(socketId);
    this.callBuckets.set(callId, bucket);
    this.refreshCallTtl(callId, ttlSeconds ?? this.defaultTtlSeconds);
    return Promise.resolve();
  }

  untrackCall(callId: string, socketId: string): Promise<void> {
    const bucket = this.callBuckets.get(callId);
    if (!bucket) return Promise.resolve();
    bucket.delete(socketId);
    if (bucket.size === 0) {
      this.callBuckets.delete(callId);
      this.clearCallTtl(callId);
    }
    return Promise.resolve();
  }

  callSockets(callId: string): Promise<Set<string>> {
    return Promise.resolve(new Set(this.callBuckets.get(callId) ?? []));
  }

  socketsForUser(userId: string): Promise<Set<string>> {
    return Promise.resolve(new Set(this.userSockets.get(userId) ?? []));
  }

  onModuleDestroy(): void {
    for (const entry of this.userTtl.values()) clearTimeout(entry.timer);
    for (const entry of this.callTtl.values()) clearTimeout(entry.timer);
    this.userTtl.clear();
    this.callTtl.clear();
    this.userSockets.clear();
    this.callBuckets.clear();
  }

  private refreshUserTtl(userId: string, ttlSeconds: number): void {
    this.clearUserTtl(userId);
    const ttlMs = ttlSeconds * 1000;
    const timer = setTimeout(() => this.expireUser(userId), ttlMs);
    if (typeof timer.unref === 'function') timer.unref();
    this.userTtl.set(userId, { timer, expiresAt: Date.now() + ttlMs });
  }

  private clearUserTtl(userId: string): void {
    const entry = this.userTtl.get(userId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.userTtl.delete(userId);
  }

  private expireUser(userId: string): void {
    this.userSockets.delete(userId);
    this.userTtl.delete(userId);
  }

  private refreshCallTtl(callId: string, ttlSeconds: number): void {
    this.clearCallTtl(callId);
    const ttlMs = ttlSeconds * 1000;
    const timer = setTimeout(() => this.expireCall(callId), ttlMs);
    if (typeof timer.unref === 'function') timer.unref();
    this.callTtl.set(callId, { timer, expiresAt: Date.now() + ttlMs });
  }

  private clearCallTtl(callId: string): void {
    const entry = this.callTtl.get(callId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.callTtl.delete(callId);
  }

  private expireCall(callId: string): void {
    this.callBuckets.delete(callId);
    this.callTtl.delete(callId);
  }
}
