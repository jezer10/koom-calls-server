export interface JoinPayload {
  roomId: string;
  userId: string;
}

export interface SignalPayload {
  roomId: string;
  from: string;
  to: string;
  signal: unknown;
}

export interface ExistingUsersEvent {
  socketIds: string[];
  members: Array<{ socketId: string; userId: string }>;
}

export interface UserJoinedEvent {
  socketId: string;
  userId: string;
}

export interface UserLeftEvent {
  socketId: string;
  userId: string;
  roomId: string;
}

export interface SignalEvent {
  from: string;
  to: string;
  signal: unknown;
  roomId: string;
}

export function isJoinPayload(value: unknown): value is JoinPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.roomId === 'string' &&
    v.roomId.length > 0 &&
    typeof v.userId === 'string' &&
    v.userId.length > 0
  );
}

export function isSignalPayload(value: unknown): value is SignalPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.roomId === 'string' &&
    typeof v.from === 'string' &&
    typeof v.to === 'string' &&
    'signal' in v
  );
}
