import { GoogleService } from './google.service';
import type { TokenPayload } from 'google-auth-library';
import type { GoogleConfig } from '../../../config/app.config';

function buildPayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://accounts.google.com',
    aud: 'client-id-test',
    sub: 'google-sub-1',
    email: 'g@x.com',
    email_verified: true,
    name: 'G',
    picture: 'http://x/p.png',
    iat: now,
    exp: now + 600,
    ...overrides,
  };
}

describe('GoogleService', () => {
  const clientId = 'client-id-test';
  const clientSecret = 'client-secret-test';
  const redirectUri = 'https://app.example.com/auth/google/callback';
  let service: GoogleService;
  let mockClient: {
    generateAuthUrl: jest.Mock;
    getToken: jest.Mock;
    verifyIdToken: jest.Mock;
  };

  const buildService = (
    id: string | undefined,
    secret?: string,
    redirect?: string,
  ): GoogleService => {
    const googleConfig: GoogleConfig = {
      clientId: id ?? '',
      clientSecret: secret ?? '',
      redirectUri: redirect ?? '',
      frontendOrigin: '',
    };
    const s = new GoogleService(googleConfig);
    if (id && secret && redirect) {
      s.onModuleInit();
      mockClient = {
        generateAuthUrl: jest.fn(),
        getToken: jest.fn(),
        verifyIdToken: jest.fn(),
      };
      (s as unknown as { client: unknown }).client = mockClient;
    }
    return s;
  };

  beforeEach(() => {
    mockClient = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      verifyIdToken: jest.fn(),
    };
    service = buildService(clientId, clientSecret, redirectUri);
  });

  it('enables meta when all env vars are set', () => {
    expect(service.meta.enabled).toBe(true);
    expect(service.meta.name).toBe('google');
    expect(service.meta.startUrl).toBe('/auth/google/start');
  });

  it('is disabled when GOOGLE_CLIENT_ID is missing', () => {
    const s = buildService(undefined);
    expect(s.meta.enabled).toBe(false);
  });

  it('is disabled when GOOGLE_CLIENT_SECRET is missing', () => {
    const s = buildService(clientId, undefined, redirectUri);
    expect(s.meta.enabled).toBe(false);
  });

  it('is disabled when GOOGLE_REDIRECT_URI is missing', () => {
    const s = buildService(clientId, clientSecret, undefined);
    expect(s.meta.enabled).toBe(false);
  });

  describe('buildAuthorizationUrl', () => {
    it('delegates to OAuth2Client.generateAuthUrl and returns its result', () => {
      mockClient.generateAuthUrl.mockReturnValue(
        'https://accounts.google.com/...',
      );
      const url = service.buildAuthorizationUrl('state-xyz');
      expect(mockClient.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'state-xyz',
          access_type: 'online',
          prompt: 'select_account',
          redirect_uri: redirectUri,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          scope: expect.arrayContaining(['openid', 'email', 'profile']),
        }),
      );
      expect(url).toBe('https://accounts.google.com/...');
    });

    it('throws when service is not configured', () => {
      const s = buildService(undefined);
      expect(() => s.buildAuthorizationUrl('s')).toThrow();
    });
  });

  describe('exchangeAndVerify', () => {
    it('exchanges code, verifies id_token, and returns a profile', async () => {
      mockClient.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      mockClient.verifyIdToken.mockResolvedValue({
        getPayload: () => buildPayload(),
      });
      const profile = await service.exchangeAndVerify('code-1');
      expect(mockClient.getToken).toHaveBeenCalledWith({
        code: 'code-1',
        redirect_uri: redirectUri,
      });
      expect(profile).toEqual({
        provider: 'google',
        providerSub: 'google-sub-1',
        email: 'g@x.com',
        emailVerified: true,
        displayName: 'G',
        picture: 'http://x/p.png',
      });
    });

    it('rejects empty code', async () => {
      await expect(service.exchangeAndVerify('')).rejects.toThrow(/required/);
    });

    it('rejects when getToken throws', async () => {
      mockClient.getToken.mockRejectedValue(new Error('bad code'));
      await expect(service.exchangeAndVerify('code')).rejects.toThrow(
        /code exchange/,
      );
    });

    it('rejects when id_token is missing from token response', async () => {
      mockClient.getToken.mockResolvedValue({ tokens: {} });
      await expect(service.exchangeAndVerify('code')).rejects.toThrow(
        /id_token/,
      );
    });

    it('rejects when verifyIdToken throws (bad signature)', async () => {
      mockClient.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      mockClient.verifyIdToken.mockRejectedValue(new Error('bad signature'));
      await expect(service.exchangeAndVerify('code')).rejects.toThrow(
        /bad signature/,
      );
    });

    it('rejects when payload is null', async () => {
      mockClient.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      mockClient.verifyIdToken.mockResolvedValue({ getPayload: () => null });
      await expect(service.exchangeAndVerify('code')).rejects.toThrow(
        /no payload/,
      );
    });

    it('rejects when issuer is invalid', async () => {
      mockClient.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      mockClient.verifyIdToken.mockResolvedValue({
        getPayload: () => buildPayload({ iss: 'https://attacker' }),
      });
      await expect(service.exchangeAndVerify('code')).rejects.toThrow(/issuer/);
    });

    it('rejects when audience does not match', async () => {
      mockClient.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      mockClient.verifyIdToken.mockResolvedValue({
        getPayload: () => buildPayload({ aud: 'other-client' }),
      });
      await expect(service.exchangeAndVerify('code')).rejects.toThrow(
        /audience/,
      );
    });

    it('rejects when sub is empty', async () => {
      mockClient.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      mockClient.verifyIdToken.mockResolvedValue({
        getPayload: () => buildPayload({ sub: '' }),
      });
      await expect(service.exchangeAndVerify('code')).rejects.toThrow(
        /subject/,
      );
    });

    it('rejects when email_verified is false', async () => {
      mockClient.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      mockClient.verifyIdToken.mockResolvedValue({
        getPayload: () => buildPayload({ email_verified: false }),
      });
      await expect(service.exchangeAndVerify('code')).rejects.toThrow(
        /not verified/,
      );
    });

    it('rejects when token is expired', async () => {
      const past = Math.floor(Date.now() / 1000) - 60;
      mockClient.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      mockClient.verifyIdToken.mockResolvedValue({
        getPayload: () => buildPayload({ exp: past }),
      });
      await expect(service.exchangeAndVerify('code')).rejects.toThrow(
        /expired/,
      );
    });
  });
});
