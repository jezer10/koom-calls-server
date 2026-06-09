export interface SfuToken {
  token: string;
  url: string;
  roomId: string;
  callId: string;
  userId: string;
  expiresAt: string;
}

export interface SfuTokenRequest {
  callId: string;
  userId: string;
}

export interface SfuService {
  issueToken(req: SfuTokenRequest): SfuToken | Promise<SfuToken>;
}

export const SFU_SERVICE = Symbol('SfuService');
