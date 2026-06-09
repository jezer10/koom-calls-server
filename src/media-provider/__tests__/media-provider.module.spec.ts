import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  LIVEKIT_API_KEY_ENV,
  LIVEKIT_API_SECRET_ENV,
  LIVEKIT_URL_ENV,
  MediaProviderModule,
  readMediaProviderEnv,
  selectMediaProvider,
} from '../media-provider.module';
import { LiveKitMediaProvider } from '../livekit.media-provider';
import { NoopMediaProvider } from '../noop.media-provider';
import {
  MEDIA_PROVIDER,
  type MediaProvider,
} from '../media-provider.interface';

function buildModule(values: Record<string, string>) {
  const configService: Partial<ConfigService> = {
    get: <T = string>(key: string): T | undefined =>
      values[key] as unknown as T,
  };
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
      MediaProviderModule,
    ],
  })
    .overrideProvider(ConfigService)
    .useValue(configService)
    .compile();
}

describe('media-provider module', () => {
  describe('readMediaProviderEnv', () => {
    it('returns empty object when no env is set', () => {
      expect(readMediaProviderEnv({})).toEqual({});
    });

    it('returns empty object when only some env vars are set', () => {
      expect(readMediaProviderEnv({ [LIVEKIT_URL_ENV]: 'wss://x' })).toEqual(
        {},
      );
      expect(
        readMediaProviderEnv({
          [LIVEKIT_URL_ENV]: 'wss://x',
          [LIVEKIT_API_KEY_ENV]: 'k',
        }),
      ).toEqual({});
    });

    it('returns all three values when fully set', () => {
      const env = {
        [LIVEKIT_URL_ENV]: 'wss://livekit',
        [LIVEKIT_API_KEY_ENV]: 'key',
        [LIVEKIT_API_SECRET_ENV]: 'secret',
      };
      expect(readMediaProviderEnv(env)).toEqual({
        url: 'wss://livekit',
        httpUrl: 'https://livekit',
        apiKey: 'key',
        apiSecret: 'secret',
      });
    });
  });

  describe('selectMediaProvider', () => {
    it('returns a LiveKitMediaProvider when env is fully set', () => {
      const provider = selectMediaProvider({
        url: 'wss://livekit',
        apiKey: 'k',
        apiSecret: 's',
      });
      expect(provider).toBeInstanceOf(LiveKitMediaProvider);
    });

    it('returns a NoopMediaProvider when env is empty', () => {
      expect(selectMediaProvider({})).toBeInstanceOf(NoopMediaProvider);
    });

    it('returns a NoopMediaProvider when env is partial', () => {
      expect(
        selectMediaProvider({ url: 'wss://x', apiKey: 'k' }),
      ).toBeInstanceOf(NoopMediaProvider);
    });
  });

  describe('MediaProviderModule', () => {
    it('provides a LiveKitMediaProvider when ConfigService has LiveKit vars', async () => {
      const mod = await buildModule({
        LIVEKIT_URL: 'wss://livekit',
        LIVEKIT_API_KEY: 'APIKEY',
        LIVEKIT_API_SECRET: 'APISECRET',
      });

      const provider = mod.get<MediaProvider>(MEDIA_PROVIDER);
      expect(provider).toBeInstanceOf(LiveKitMediaProvider);
      await mod.close();
    });

    it('provides a NoopMediaProvider when ConfigService has no LiveKit vars', async () => {
      const mod = await buildModule({});

      const provider = mod.get<MediaProvider>(MEDIA_PROVIDER);
      expect(provider).toBeInstanceOf(NoopMediaProvider);
      await mod.close();
    });

    it('exposes MEDIA_PROVIDER through @Global export', async () => {
      const mod = await buildModule({});

      expect(() => mod.get<MediaProvider>(MEDIA_PROVIDER)).not.toThrow();
      await mod.close();
    });
  });
});
