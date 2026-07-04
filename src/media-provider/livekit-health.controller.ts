import { Controller, Get, HttpCode, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject, type OnModuleInit } from '@nestjs/common';
import {
  MEDIA_PROVIDER,
  type MediaProvider,
  type MediaProviderRole,
} from './media-provider.interface';
import {
  createLiveKitClient,
  type LiveKitClientBundle,
} from './livekit.client';
import { deriveHttpUrl } from '../config/livekit.config';

interface LiveKitHealth {
  provider: 'livekit' | 'noop';
  configured: boolean;
  url?: string;
  httpUrl?: string;
  apiKey?: string;
  checks: {
    accessToken: {
      ok: boolean;
      error?: string;
      tokenPreview?: string;
      expiresAt?: string;
    };
    room: {
      ok: boolean;
      error?: string;
      roomName?: string;
      providerRoomId?: string;
    };
    listRooms: { ok: boolean; error?: string; count?: number };
  };
  timestamp: string;
}

@Controller('info/livekit')
export class LiveKitHealthController implements OnModuleInit {
  private readonly logger = new Logger(LiveKitHealthController.name);
  private directClient: LiveKitClientBundle | undefined;
  private readonly livekitUrl: string;
  private readonly livekitHttpUrl: string;
  private readonly livekitApiKey: string;
  private readonly livekitApiSecret: string;

  constructor(
    configService: ConfigService,
    @Optional()
    @Inject(MEDIA_PROVIDER)
    private readonly provider?: MediaProvider,
  ) {
    this.livekitUrl = configService.get<string>('livekit.url') ?? '';
    this.livekitHttpUrl =
      configService.get<string>('livekit.httpUrl') ||
      deriveHttpUrl(this.livekitUrl);
    this.livekitApiKey = configService.get<string>('livekit.apiKey') ?? '';
    this.livekitApiSecret =
      configService.get<string>('livekit.apiSecret') ?? '';
  }

  onModuleInit(): void {
    if (this.livekitHttpUrl && this.livekitApiKey && this.livekitApiSecret) {
      this.directClient = createLiveKitClient({
        url: this.livekitHttpUrl,
        apiKey: this.livekitApiKey,
        apiSecret: this.livekitApiSecret,
      });
    }
  }

  @Get()
  @HttpCode(200)
  async getHealth(): Promise<LiveKitHealth> {
    const configured = Boolean(
      this.livekitUrl && this.livekitApiKey && this.livekitApiSecret,
    );
    const base: LiveKitHealth = {
      provider: this.livekitUrl ? 'livekit' : 'noop',
      configured,
      url: this.livekitUrl || undefined,
      httpUrl: this.livekitHttpUrl || undefined,
      apiKey: this.livekitApiKey || undefined,
      checks: {
        accessToken: { ok: false },
        room: { ok: false },
        listRooms: { ok: false },
      },
      timestamp: new Date().toISOString(),
    };

    if (!this.provider) {
      return base;
    }

    const probeCallId = `health-${Date.now()}`;
    const probeUserId = 'healthcheck';
    const role: MediaProviderRole = 'host';

    try {
      const tokenResult = await this.provider.createAccessToken({
        callId: probeCallId,
        userId: probeUserId,
        role,
        ttlSeconds: 60,
      });
      base.checks.accessToken = {
        ok: true,
        tokenPreview: `${tokenResult.token.slice(0, 24)}…`,
        expiresAt: tokenResult.expiresAt.toISOString(),
      };
    } catch (err) {
      base.checks.accessToken = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (this.directClient) {
      try {
        const rooms = await this.directClient.roomService.listRooms();
        base.checks.listRooms = { ok: true, count: rooms.length };
      } catch (err) {
        base.checks.listRooms = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    if (this.provider.createRoom) {
      try {
        const room = await this.provider.createRoom(probeCallId);
        base.checks.room = { ok: true, ...room };
        try {
          await this.provider.deleteRoom(probeCallId);
        } catch (err) {
          this.logger.debug(
            `probe room cleanup skipped: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      } catch (err) {
        base.checks.room = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return base;
  }
}
