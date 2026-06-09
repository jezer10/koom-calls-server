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

describe('media-provider module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env[LIVEKIT_URL_ENV];
    delete process.env[LIVEKIT_API_KEY_ENV];
    delete process.env[LIVEKIT_API_SECRET_ENV];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

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
    it('provides a LiveKitMediaProvider when env is set', async () => {
      process.env[LIVEKIT_URL_ENV] = 'wss://livekit';
      process.env[LIVEKIT_API_KEY_ENV] = 'APIKEY';
      process.env[LIVEKIT_API_SECRET_ENV] = 'APISECRET';

      const mod = await Test.createTestingModule({
        imports: [MediaProviderModule],
      }).compile();

      const provider = mod.get<MediaProvider>(MEDIA_PROVIDER);
      expect(provider).toBeInstanceOf(LiveKitMediaProvider);
      await mod.close();
    });

    it('provides a NoopMediaProvider when env is unset', async () => {
      const mod = await Test.createTestingModule({
        imports: [MediaProviderModule],
      }).compile();

      const provider = mod.get<MediaProvider>(MEDIA_PROVIDER);
      expect(provider).toBeInstanceOf(NoopMediaProvider);
      await mod.close();
    });

    it('exposes MEDIA_PROVIDER through @Global export', async () => {
      const mod = await Test.createTestingModule({
        imports: [MediaProviderModule],
      }).compile();

      expect(() => mod.get<MediaProvider>(MEDIA_PROVIDER)).not.toThrow();
      await mod.close();
    });
  });
});
