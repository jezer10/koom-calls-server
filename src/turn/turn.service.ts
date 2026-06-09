import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { loadConfig } from '../config/app.config';
import type { IceServer, TurnCredentials } from './turn.types';

export interface TurnService {
  generateCredentials(userId: string, now?: Date): TurnCredentials;
}

export const TURN_CONFIG = 'TURN_CONFIG';
export const TURN_CLOCK = 'TURN_CLOCK';

export type TurnClock = () => Date;

export interface TurnConfig {
  url: string;
  sharedSecret: string;
  ttlSeconds: number;
  realm: string;
  stunUrls: string[];
}

const defaultClock: TurnClock = () => new Date();

@Injectable()
export class CoturnTurnService implements TurnService {
  constructor(
    @Inject(TURN_CONFIG) private readonly config: TurnConfig,
    @Optional()
    @Inject(TURN_CLOCK)
    private readonly clock: TurnClock = defaultClock,
  ) {}

  static fromEnv(): TurnConfig {
    return loadConfig().turn;
  }

  generateCredentials(userId: string, now?: Date): TurnCredentials {
    const effectiveNow = now ?? this.clock();
    const expiryTimestamp =
      Math.floor(effectiveNow.getTime() / 1000) + this.config.ttlSeconds;
    const username = `${expiryTimestamp}:${userId}`;
    const password = signTurnPassword(this.config.sharedSecret, username);

    const iceServers: IceServer[] = [
      ...this.config.stunUrls.map((url) => ({ urls: url })),
      {
        urls: [
          `${this.config.url}?transport=udp`,
          `${this.config.url}?transport=tcp`,
        ],
        username,
        credential: password,
        credentialType: 'password' as const,
      },
    ];

    return {
      iceServers,
      expiresAt: new Date(expiryTimestamp * 1000).toISOString(),
    };
  }
}

export function signTurnPassword(secret: string, username: string): string {
  return createHmac('sha1', secret).update(username).digest('base64');
}
