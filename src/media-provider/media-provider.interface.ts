export const MEDIA_PROVIDER = Symbol('MEDIA_PROVIDER');

export type MediaProviderRole = 'host' | 'participant' | 'moderator';

export interface CreateAccessTokenArgs {
  userId: string;
  callId: string;
  role: MediaProviderRole;
  ttlSeconds?: number;
}

export interface CreateAccessTokenResult {
  token: string;
  url: string;
  expiresAt: Date;
}

export interface CreateRoomResult {
  roomName: string;
  providerRoomId: string;
}

export interface MediaProvider {
  createRoom(callId: string): Promise<CreateRoomResult>;
  deleteRoom(callId: string): Promise<void>;
  createAccessToken(
    args: CreateAccessTokenArgs,
  ): Promise<CreateAccessTokenResult>;
  validateWebhook?(payload: unknown, signature: string): boolean;
}

export function roomNameForCall(callId: string): string {
  return `koom-call-${callId}`;
}
