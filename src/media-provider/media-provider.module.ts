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

export const LIVEKIT_URL_ENV = 'LIVEKIT_URL';
export const LIVEKIT_API_KEY_ENV = 'LIVEKIT_API_KEY';
export const LIVEKIT_API_SECRET_ENV = 'LIVEKIT_API_SECRET';

export interface MediaProviderEnv {
  url?: string;
  apiKey?: string;
  apiSecret?: string;
}

export function readMediaProviderEnv(
  source: Partial<Record<'LIVEKIT_URL' | 'LIVEKIT_API_KEY' | 'LIVEKIT_API_SECRET', string | undefined>> = {},
): MediaProviderEnv {
  const url = source.LIVEKIT_URL;
  const apiKey = source.LIVEKIT_API_KEY;
  const apiSecret = source.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    return {};
  }
  return { url, apiKey, apiSecret };
}

export function selectMediaProvider(env: MediaProviderEnv): MediaProvider {
  if (env.url && env.apiKey && env.apiSecret) {
    return new LiveKitMediaProvider({
      client: createLiveKitClient({
        url: env.url,
        apiKey: env.apiKey,
        apiSecret: env.apiSecret,
      }),
    });
  }
  return new NoopMediaProvider();
}

@Global()
@Module({
  providers: [
    {
      provide: MEDIA_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MediaProvider =>
        selectMediaProvider(
          readMediaProviderEnv({
            LIVEKIT_URL: configService.get<string>('LIVEKIT_URL'),
            LIVEKIT_API_KEY: configService.get<string>('LIVEKIT_API_KEY'),
            LIVEKIT_API_SECRET: configService.get<string>(
              'LIVEKIT_API_SECRET',
            ),
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
    });
    if (env.url && env.apiKey && env.apiSecret) {
      this.logger.log(
        `MediaProvider: LiveKit (url=${env.url}, key=${env.apiKey})`,
      );
    } else {
      this.logger.warn(
        'MediaProvider: Noop (LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET not all set)',
      );
    }
  }
}
