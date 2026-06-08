export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
  expiresAt: string;
}

export interface TurnCredentialsOptions {
  userId: string;
  callId: string;
}

export interface TurnService {
  generateCredentials(
    opts: TurnCredentialsOptions,
  ): TurnCredentials | Promise<TurnCredentials>;
}

export const TURN_SERVICE = Symbol('TurnService');
