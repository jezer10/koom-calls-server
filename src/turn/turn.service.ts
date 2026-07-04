import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import {
  TurnCredentials,
  TurnCredentialsOptions,
  TurnService,
} from './turn.types';

@Injectable()
export class StaticTurnService implements TurnService {
  private readonly logger = new Logger(StaticTurnService.name);
  private readonly ttlSeconds: number;
  private readonly urls: string[];
  private readonly sharedSecret: string;

  constructor(configService: ConfigService) {
    this.sharedSecret = configService.getOrThrow<string>('turn.sharedSecret');
    this.ttlSeconds = configService.get<number>('turn.ttlSeconds') ?? 3600;
    this.urls = configService.get<string[]>('turn.urls') ?? [
      'turn:turn.koom.example.com:3478?transport=udp',
      'turn:turn.koom.example.com:3478?transport=tcp',
    ];
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
    return crypto
      .createHmac('sha1', this.sharedSecret)
      .update(`${input}:${expiresAt}`)
      .digest('base64');
  }
}
