import {
  Global,
  Logger,
  Module,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MEDIA_PROVIDER, type MediaProvider } from './media-provider.interface';
import { LiveKitMediaProvider } from './livekit.media-provider';
import { NoopMediaProvider } from './noop.media-provider';
import { createLiveKitClient } from './livekit.client';
import { LiveKitHealthController } from './livekit-health.controller';

export const LIVEKIT_URL_ENV = 'LIVEKIT_URL';
export const LIVEKIT_API_KEY_ENV = 'LIVEKIT_API_KEY';
export const LIVEKIT_API_SECRET_ENV = 'LIVEKIT_API_SECRET';
export const LIVEKIT_HTTP_URL_ENV = 'LIVEKIT_HTTP_URL';

export interface MediaProviderEnv {
  url?: string;
  httpUrl?: string;
  apiKey?: string;
  apiSecret?: string;
}

function deriveHttpUrl(wsUrl: string | undefined): string | undefined {
  if (!wsUrl) return undefined;
  if (wsUrl.startsWith('http://') || wsUrl.startsWith('https://')) return wsUrl;
  if (wsUrl.startsWith('ws://')) return `http://${wsUrl.slice('ws://'.length)}`;
  if (wsUrl.startsWith('wss://'))
    return `https://${wsUrl.slice('wss://'.length)}`;
  return wsUrl;
}

export function readMediaProviderEnv(
  source: Partial<
    Record<
      | 'LIVEKIT_URL'
      | 'LIVEKIT_API_KEY'
      | 'LIVEKIT_API_SECRET'
      | 'LIVEKIT_HTTP_URL',
      string | undefined
    >
  > = {},
): MediaProviderEnv {
  const url = source.LIVEKIT_URL;
  const apiKey = source.LIVEKIT_API_KEY;
  const apiSecret = source.LIVEKIT_API_SECRET;
  const httpUrl = source.LIVEKIT_HTTP_URL || deriveHttpUrl(url);
  if (!url || !apiKey || !apiSecret) {
    return {};
  }
  return { url, httpUrl, apiKey, apiSecret };
}

export function selectMediaProvider(env: MediaProviderEnv): MediaProvider {
  if (env.url && env.apiKey && env.apiSecret) {
    return new LiveKitMediaProvider({
      client: createLiveKitClient({
        url: env.httpUrl ?? env.url,
        apiKey: env.apiKey,
        apiSecret: env.apiSecret,
      }),
    });
  }
  return new NoopMediaProvider();
}

@Global()
@Module({
  controllers: [LiveKitHealthController],
  providers: [
    {
      provide: MEDIA_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MediaProvider =>
        selectMediaProvider(
          readMediaProviderEnv({
            LIVEKIT_URL: configService.get<string>('LIVEKIT_URL'),
            LIVEKIT_API_KEY: configService.get<string>('LIVEKIT_API_KEY'),
            LIVEKIT_API_SECRET: configService.get<string>('LIVEKIT_API_SECRET'),
            LIVEKIT_HTTP_URL: configService.get<string>('LIVEKIT_HTTP_URL'),
          }),
        ),
    },
  ],
  exports: [MEDIA_PROVIDER],
})
export class MediaProviderModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaProviderModule.name);

  constructor(private readonly configService: ConfigService) {}

  onApplicationBootstrap(): void {
    const env = readMediaProviderEnv({
      LIVEKIT_URL: this.configService.get<string>('LIVEKIT_URL'),
      LIVEKIT_API_KEY: this.configService.get<string>('LIVEKIT_API_KEY'),
      LIVEKIT_API_SECRET: this.configService.get<string>('LIVEKIT_API_SECRET'),
      LIVEKIT_HTTP_URL: this.configService.get<string>('LIVEKIT_HTTP_URL'),
    });
    if (env.url && env.apiKey && env.apiSecret) {
      this.logger.log(
        `MediaProvider: LiveKit (url=${env.url}, httpUrl=${env.httpUrl}, key=${env.apiKey})`,
      );
    } else {
      this.logger.warn(
        'MediaProvider: Noop (LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET not all set)',
      );
    }
  }
}
