import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  TurnCredentials,
  TurnCredentialsOptions,
  TurnService,
} from './turn.types';
import { APP_CONFIG } from '../config/app-config.module';
import type { AppConfig } from '../config/app.config';

@Injectable()
export class StaticTurnService implements TurnService {
  private readonly logger = new Logger(StaticTurnService.name);
  private readonly ttlSeconds: number;
  private readonly urls: string[];
  private readonly jwtSecret: string;

  constructor(@Inject(APP_CONFIG) appConfig: AppConfig) {
    this.jwtSecret = appConfig.jwt.secret;
    this.ttlSeconds = appConfig.turn.ttlSeconds;
    this.urls = appConfig.turn.urls;
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
      .createHmac('sha1', this.jwtSecret)
      .update(`${input}:${expiresAt}`)
      .digest('base64');
  }
}
