import type {
  CreateAccessTokenArgs,
  CreateAccessTokenResult,
  CreateRoomResult,
  MediaProvider,
} from './media-provider.interface';
import { roomNameForCall } from './media-provider.interface';

const NOOP_URL = 'noop://localhost';
const NOOP_TOKEN_TTL_SECONDS = 60 * 60;

export class NoopMediaProvider implements MediaProvider {
  private readonly url: string;
  private readonly ttlSeconds: number;

  constructor(options: { url?: string; ttlSeconds?: number } = {}) {
    this.url = options.url ?? NOOP_URL;
    this.ttlSeconds = options.ttlSeconds ?? NOOP_TOKEN_TTL_SECONDS;
  }

  createRoom(callId: string): Promise<CreateRoomResult> {
    const roomName = roomNameForCall(callId);
    return Promise.resolve({
      roomName,
      providerRoomId: `noop-${callId}`,
    });
  }

  deleteRoom(_callId: string): Promise<void> {
    return Promise.resolve();
  }

  createAccessToken(
    args: CreateAccessTokenArgs,
  ): Promise<CreateAccessTokenResult> {
    const ttlSeconds = args.ttlSeconds ?? this.ttlSeconds;
    const token = `noop-token:${args.userId}:${args.callId}:${args.role}`;
    return Promise.resolve({
      token,
      url: this.url,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });
  }

  validateWebhook(_payload: unknown, _signature: string): boolean {
    return false;
  }
}
