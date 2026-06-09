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

export function resolvePresenceTtl(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.PRESENCE_TTL_SECONDS;
  if (raw === undefined || raw === '') return DEFAULT_PRESENCE_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PRESENCE_TTL_SECONDS;
}
