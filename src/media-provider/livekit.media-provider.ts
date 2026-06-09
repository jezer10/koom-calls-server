import type {
  CreateAccessTokenArgs,
  CreateAccessTokenResult,
  CreateRoomResult,
  MediaProvider,
  MediaProviderRole,
} from './media-provider.interface';
import { roomNameForCall } from './media-provider.interface';
import {
  createLiveKitAccessToken,
  type LiveKitClientBundle,
} from './livekit.client';
import type { VideoGrant } from 'livekit-server-sdk';

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60;

export interface LiveKitMediaProviderOptions {
  client: LiveKitClientBundle;
  defaultTtlSeconds?: number;
}

export class LiveKitMediaProvider implements MediaProvider {
  private readonly client: LiveKitClientBundle;
  private readonly defaultTtlSeconds: number;

  constructor(options: LiveKitMediaProviderOptions) {
    this.client = options.client;
    this.defaultTtlSeconds =
      options.defaultTtlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
  }

  async createRoom(callId: string): Promise<CreateRoomResult> {
    const roomName = roomNameForCall(callId);
    const room = await this.client.roomService.createRoom({ name: roomName });
    const sid = (room as { sid?: unknown }).sid;
    const providerRoomId =
      typeof sid === 'string' && sid.length > 0 ? sid : roomName;
    return {
      roomName,
      providerRoomId,
    };
  }

  async deleteRoom(callId: string): Promise<void> {
    const roomName = roomNameForCall(callId);
    await this.client.roomService.deleteRoom(roomName);
  }

  async createAccessToken(
    args: CreateAccessTokenArgs,
  ): Promise<CreateAccessTokenResult> {
    const roomName = roomNameForCall(args.callId);
    const ttlSeconds = args.ttlSeconds ?? this.defaultTtlSeconds;
    const token = createLiveKitAccessToken(
      this.client.apiKey,
      this.client.apiSecret,
      { identity: args.userId, ttlSeconds },
    );
    token.addGrant(this.buildGrant(args.role, roomName));
    const jwt = await token.toJwt();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return {
      token: jwt,
      url: this.client.url,
      expiresAt,
    };
  }

  // TODO(LBR-74): livekit-server-sdk's WebhookReceiver.receive is async-only
  // while the MediaProvider interface exposes validateWebhook synchronously.
  // Return false conservatively until the interface becomes async, then
  // delegate to this.client.webhookReceiver.receive(payload, signature).
  validateWebhook(_payload: unknown, _signature: string): boolean {
    return false;
  }

  private buildGrant(role: MediaProviderRole, roomName: string): VideoGrant {
    const base: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    };
    if (role === 'moderator') {
      return {
        ...base,
        roomAdmin: true,
        canPublishSources: [],
      };
    }
    if (role === 'host') {
      return {
        ...base,
        roomAdmin: true,
      };
    }
    return base;
  }
}
