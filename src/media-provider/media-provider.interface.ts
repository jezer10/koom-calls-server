export const MEDIA_PROVIDER = Symbol('MEDIA_PROVIDER');

export type MediaRole = 'host' | 'participant' | 'moderator';

export interface CreateAccessTokenArgs {
  userId: string;
  callId: string;
  role: MediaRole;
}

export interface AccessTokenResult {
  token: string;
  url: string;
  expiresAt: Date;
}

export interface MediaProvider {
  createRoom(callId: string): Promise<{ roomName: string }>;
  deleteRoom(callId: string): Promise<void>;
  createAccessToken(args: CreateAccessTokenArgs): Promise<AccessTokenResult>;
}
