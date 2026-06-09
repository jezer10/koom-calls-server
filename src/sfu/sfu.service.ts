import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { SfuService, SfuToken, SfuTokenRequest } from './sfu.types';

@Injectable()
export class StaticSfuService implements SfuService {
  private readonly logger = new Logger(StaticSfuService.name);
  private readonly ttlSeconds = 1800;
  private readonly sfuUrl: string;
  private readonly jwtSecret: string;

  constructor(configService: ConfigService) {
    this.sfuUrl =
      configService.get<string>('SFU_URL') ?? 'wss://sfu.koom.example.com/v1/rtc';
    this.jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
  }

  issueToken(req: SfuTokenRequest): SfuToken {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + this.ttlSeconds;
    const roomId = this.deriveRoomId(req.callId);
    const payload = {
      sub: req.userId,
      call: req.callId,
      room: roomId,
      iat: issuedAt,
      exp: expiresAt,
      iss: 'koom-sfu',
    };
    const header = { alg: 'HS256', typ: 'JWT' };
    const base64Header = this.b64url(JSON.stringify(header));
    const base64Payload = this.b64url(JSON.stringify(payload));
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${base64Header}.${base64Payload}`)
      .digest('base64url');
    const token = `${base64Header}.${base64Payload}.${signature}`;
    this.logger.debug(
      `Issued SFU token for user=${req.userId} call=${req.callId} room=${roomId}`,
    );
    return {
      token,
      url: this.sfuUrl,
      roomId,
      callId: req.callId,
      userId: req.userId,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  private deriveRoomId(callId: string): string {
    return `sfu-${callId}`;
  }

  private b64url(input: string): string {
    return Buffer.from(input, 'utf-8').toString('base64url');
  }
}
