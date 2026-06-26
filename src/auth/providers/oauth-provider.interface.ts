export interface OAuthProviderMeta {
  name: string;
  displayName: string;
  iconUrl?: string;
  /**
   * Env-var name that controls this provider (e.g. `GOOGLE_CLIENT_ID`).
   * Optional: providers that are always on (e.g. anonymous) leave it unset.
   */
  configKey?: string;
  enabled: boolean;
  startUrl?: string;
}

export interface OAuthProfile {
  provider: string;
  providerSub: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  picture: string | null;
}

export interface OAuthProvider {
  readonly meta: OAuthProviderMeta;
  /**
   * Build the URL to redirect the user to for authentication (Google
   * consent screen, GitHub authorize, etc.). The `state` is generated
   * by the back and must round-trip through the provider's callback
   * to mitigate CSRF.
   */
  buildAuthorizationUrl(state: string): string;
  /**
   * Exchange the authorization code received at the callback for
   * tokens, then verify the resulting id_token and return a normalized
   * profile.
   */
  exchangeAndVerify(code: string): Promise<OAuthProfile>;
}

export const OAUTH_PROVIDERS = Symbol('OAUTH_PROVIDERS');
export type OAuthProvidersMap = Map<string, OAuthProvider>;
