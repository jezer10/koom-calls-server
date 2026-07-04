import {
  Global,
  Injectable,
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
import { deriveHttpUrl } from '../config/livekit.config';

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
  const url = source.LIVEKIT_URL ?? '';
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

@Injectable()
class MediaProviderBootstrapLogger implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaProviderModule.name);

  constructor(private readonly configService: ConfigService) {}

  onApplicationBootstrap(): void {
    const url = this.configService.get<string>('livekit.url') ?? '';
    const apiKey = this.configService.get<string>('livekit.apiKey') ?? '';
    const apiSecret = this.configService.get<string>('livekit.apiSecret') ?? '';
    const httpUrl =
      this.configService.get<string>('livekit.httpUrl') || deriveHttpUrl(url);

    if (url && apiKey && apiSecret) {
      this.logger.log(
        `MediaProvider: LiveKit (url=${url}, httpUrl=${httpUrl}, key=${apiKey})`,
      );
      return;
    }
    this.logger.warn(
      'MediaProvider: Noop (LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET not all set)',
    );
  }
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
            LIVEKIT_URL: configService.get<string>('livekit.url'),
            LIVEKIT_HTTP_URL: configService.get<string>('livekit.httpUrl'),
            LIVEKIT_API_KEY: configService.get<string>('livekit.apiKey'),
            LIVEKIT_API_SECRET: configService.get<string>('livekit.apiSecret'),
          }),
        ),
    },
    MediaProviderBootstrapLogger,
  ],
  exports: [MEDIA_PROVIDER],
})
export class MediaProviderModule {}
