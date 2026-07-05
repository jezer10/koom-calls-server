import { OAuthProvidersRegistry } from './oauth-providers.registry';
import type {
  OAuthProvider,
  OAuthProvidersMap,
} from './oauth-provider.interface';

function buildProvider(name: string, enabled = true): OAuthProvider {
  return {
    meta: {
      name,
      displayName: name.toUpperCase(),
      configKey: `${name.toUpperCase()}_ID`,
      enabled,
      startUrl: `/auth/${name}/start`,
    },
    buildAuthorizationUrl: jest.fn(),
    exchangeAndVerify: jest.fn(),
  };
}

describe('OAuthProvidersRegistry', () => {
  it('returns empty list when no providers are registered', () => {
    const r = new OAuthProvidersRegistry(null);
    expect(r.list()).toEqual([]);
    expect(r.get('anything')).toBeUndefined();
  });

  it('lists and resolves registered providers', () => {
    const google = buildProvider('google');
    const map: OAuthProvidersMap = new Map([['google', google]]);
    const r = new OAuthProvidersRegistry(map);
    expect(r.list()).toEqual([
      {
        name: 'google',
        displayName: 'GOOGLE',
        configKey: 'GOOGLE_ID',
        enabled: true,
        startUrl: '/auth/google/start',
      },
    ]);
    expect(r.get('google')).toBe(google);
  });

  it('filters out disabled providers from list() but keeps them resolvable via get()', () => {
    const google = buildProvider('google', false);
    const map: OAuthProvidersMap = new Map([['google', google]]);
    const r = new OAuthProvidersRegistry(map);
    expect(r.list()).toEqual([]);
    expect(r.get('google')).toBe(google);
  });
});
