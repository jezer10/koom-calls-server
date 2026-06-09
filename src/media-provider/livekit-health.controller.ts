import { Controller, Get, HttpCode, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject, type OnModuleInit } from '@nestjs/common';
import {
  MEDIA_PROVIDER,
  type MediaProvider,
  type MediaProviderRole,
} from './media-provider.interface';
import {
  LIVEKIT_API_KEY_ENV,
  LIVEKIT_API_SECRET_ENV,
  LIVEKIT_HTTP_URL_ENV,
  LIVEKIT_URL_ENV,
  readMediaProviderEnv,
} from './media-provider.module';
import {
  createLiveKitClient,
  type LiveKitClientBundle,
} from './livekit.client';

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

/**
 * Public health endpoint for the media provider. Returns the resolved
 * provider (LiveKit or Noop) and exercises the LiveKit SDK end-to-end:
 *   1. mint an access token,
 *   2. create + delete a probe room,
 *   3. list rooms on the server.
 *
 * Use it from the SPA banner, a smoke-test script, or your monitoring
 * stack to confirm the SFU is reachable with the configured credentials.
 */
@Controller('info/livekit')
export class LiveKitHealthController implements OnModuleInit {
  private readonly logger = new Logger(LiveKitHealthController.name);
  private readonly env: ReturnType<typeof readMediaProviderEnv>;
  private directClient: LiveKitClientBundle | undefined;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(MEDIA_PROVIDER)
    private readonly provider?: MediaProvider,
  ) {
    this.env = readMediaProviderEnv({
      LIVEKIT_URL: this.configService.get<string>(LIVEKIT_URL_ENV),
      LIVEKIT_API_KEY: this.configService.get<string>(LIVEKIT_API_KEY_ENV),
      LIVEKIT_API_SECRET: this.configService.get<string>(
        LIVEKIT_API_SECRET_ENV,
      ),
      LIVEKIT_HTTP_URL: this.configService.get<string>(LIVEKIT_HTTP_URL_ENV),
    });
  }

  onModuleInit(): void {
    if (this.env.httpUrl && this.env.apiKey && this.env.apiSecret) {
      this.directClient = createLiveKitClient({
        url: this.env.httpUrl,
        apiKey: this.env.apiKey,
        apiSecret: this.env.apiSecret,
      });
    }
  }

  @Get()
  @HttpCode(200)
  async getHealth(): Promise<LiveKitHealth> {
    const providerName: 'livekit' | 'noop' = this.env.url ? 'livekit' : 'noop';
    const base: LiveKitHealth = {
      provider: providerName,
      configured: Boolean(
        this.env.url && this.env.apiKey && this.env.apiSecret,
      ),
      url: this.env.url,
      httpUrl: this.env.httpUrl,
      apiKey: this.env.apiKey,
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

    // 1. Token mint
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

    // 2. List rooms via the raw SDK (independent of MediaProvider interface)
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

    // 3. Create + (best-effort) delete a probe room via the MediaProvider
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
