import { Injectable, Logger } from '@nestjs/common';
import type {
  AccessTokenResult,
  CreateAccessTokenArgs,
  MediaProvider,
} from './media-provider.interface';

@Injectable()
export class NoopMediaProvider implements MediaProvider {
  private readonly logger = new Logger(NoopMediaProvider.name);
  private readonly createdAt = Date.now();

  createRoom(callId: string): Promise<{ roomName: string }> {
    this.logger.debug(`[noop] createRoom(${callId})`);
    return Promise.resolve({ roomName: `room-${callId}` });
  }

  deleteRoom(callId: string): Promise<void> {
    this.logger.debug(`[noop] deleteRoom(${callId})`);
    return Promise.resolve();
  }

  createAccessToken(args: CreateAccessTokenArgs): Promise<AccessTokenResult> {
    this.logger.debug(
      `[noop] createAccessToken(user=${args.userId} call=${args.callId} role=${args.role})`,
    );
    const token = `noop-token-${this.createdAt}-${args.userId}-${args.callId}-${args.role}`;
    return Promise.resolve({
      token,
      url: `https://noop.invalid/${args.callId}?token=${token}`,
      expiresAt: new Date(this.createdAt + 60 * 60 * 1000),
    });
  }
}
