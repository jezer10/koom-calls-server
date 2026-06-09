import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  TurnCredentials,
  TurnCredentialsOptions,
  TurnService,
} from './turn.types';
import { loadConfig } from '../config/app.config';

@Injectable()
export class StaticTurnService implements TurnService {
  private readonly logger = new Logger(StaticTurnService.name);
  private readonly ttlSeconds = 3600;
  private readonly urls: string[];

  constructor() {
    const raw = process.env.TURN_URLS;
    if (raw && raw.length > 0) {
      this.urls = raw
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
    } else {
      this.urls = [
        'turn:turn.koom.example.com:3478?transport=udp',
        'turn:turn.koom.example.com:3478?transport=tcp',
      ];
    }
  }

  generateCredentials(opts: TurnCredentialsOptions): TurnCredentials {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + this.ttlSeconds;
    const credential = this.hmac(`${opts.userId}:${opts.callId}`, expiresAt);
    this.logger.debug(
      `Issued TURN creds for user=${opts.userId} call=${opts.callId} ttl=${this.ttlSeconds}s`,
    );
    return {
      urls: [...this.urls],
      username: `${opts.userId}:${expiresAt}`,
      credential,
      ttl: this.ttlSeconds,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  private hmac(input: string, expiresAt: number): string {
    const config = loadConfig();
    return crypto
      .createHmac('sha1', config.jwt.secret)
      .update(`${input}:${expiresAt}`)
      .digest('base64');
  }
}
