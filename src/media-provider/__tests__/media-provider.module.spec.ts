import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
import { LIVEKIT_CONFIG } from '../../config/app-config.module';
import type { LiveKitConfig } from '../../config/app.config';

function buildLivekitConfig(values: Partial<LiveKitConfig>): LiveKitConfig {
  return {
    url: '',
    apiKey: '',
    apiSecret: '',
    httpUrl: '',
    sfuUrl: '',
    ...values,
  };
}

function buildModule(livekit: LiveKitConfig) {
  @Global()
  @Module({
    providers: [{ provide: LIVEKIT_CONFIG, useValue: livekit }],
    exports: [LIVEKIT_CONFIG],
  })
  class FakeLivekitConfigModule {}

  return Test.createTestingModule({
    imports: [FakeLivekitConfigModule, MediaProviderModule],
  }).compile();
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
    it('provides a LiveKitMediaProvider when LIVEKIT_CONFIG has LiveKit vars', async () => {
      const mod = await buildModule(
        buildLivekitConfig({
          url: 'wss://livekit',
          apiKey: 'APIKEY',
          apiSecret: 'APISECRET',
        }),
      );

      const provider = mod.get<MediaProvider>(MEDIA_PROVIDER);
      expect(provider).toBeInstanceOf(LiveKitMediaProvider);
      await mod.close();
    });

    it('provides a NoopMediaProvider when LIVEKIT_CONFIG has no LiveKit vars', async () => {
      const mod = await buildModule(buildLivekitConfig({}));

      const provider = mod.get<MediaProvider>(MEDIA_PROVIDER);
      expect(provider).toBeInstanceOf(NoopMediaProvider);
      await mod.close();
    });

    it('exposes MEDIA_PROVIDER through @Global export', async () => {
      const mod = await buildModule(buildLivekitConfig({}));

      expect(() => mod.get<MediaProvider>(MEDIA_PROVIDER)).not.toThrow();
      await mod.close();
    });
  });
});
