import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VideoGrant } from 'livekit-server-sdk';
import { createLiveKitAccessToken } from '../media-provider/livekit.client';
import { SfuService, SfuToken, SfuTokenRequest } from './sfu.types';

@Injectable()
export class StaticSfuService implements SfuService {
  private readonly logger = new Logger(StaticSfuService.name);
  private readonly ttlSeconds = 1800;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly sfuUrl: string;

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('livekit.apiKey') ?? '';
    this.apiSecret = configService.get<string>('livekit.apiSecret') ?? '';
    this.sfuUrl = configService.get<string>('livekit.sfuUrl') ?? '';
  }

  async issueToken(req: SfuTokenRequest): Promise<SfuToken> {
    if (!this.apiKey || !this.apiSecret) {
      throw new ServiceUnavailableException(
        'SFU no configurado: define LIVEKIT_API_KEY y LIVEKIT_API_SECRET',
      );
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + this.ttlSeconds;
    const roomId = this.deriveRoomId(req.callId);
    const token = createLiveKitAccessToken(this.apiKey, this.apiSecret, {
      identity: req.userId,
      ttlSeconds: this.ttlSeconds,
    });
    token.addGrant(this.buildParticipantGrant(roomId));
    const jwt = await token.toJwt();
    this.logger.debug(
      `Issued LiveKit SFU token for user=${req.userId} call=${req.callId} room=${roomId}`,
    );
    return {
      token: jwt,
      url: this.sfuUrl,
      roomId,
      callId: req.callId,
      userId: req.userId,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  private buildParticipantGrant(roomName: string): VideoGrant {
    return {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    };
  }

  private deriveRoomId(callId: string): string {
    return `sfu-${callId}`;
  }
}
