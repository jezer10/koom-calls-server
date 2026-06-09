export const DEFAULT_PRESENCE_TTL_SECONDS = 60;

export interface PresenceService {
  markOnline(
    userId: string,
    socketId: string,
    ttlSeconds?: number,
  ): Promise<void>;
  markOffline(userId: string, socketId: string): Promise<void>;
  whoIsOnline(userIds: string[]): Promise<Set<string>>;
  trackCall(
    callId: string,
    socketId: string,
    ttlSeconds?: number,
  ): Promise<void>;
  untrackCall(callId: string, socketId: string): Promise<void>;
  callSockets(callId: string): Promise<Set<string>>;
  socketsForUser(userId: string): Promise<Set<string>>;
}

export function resolvePresenceTtl(ttl?: number | null): number {
  if (ttl === undefined || ttl === null || !Number.isFinite(ttl) || ttl <= 0) {
    return DEFAULT_PRESENCE_TTL_SECONDS;
  }
  return Math.trunc(ttl);
}
