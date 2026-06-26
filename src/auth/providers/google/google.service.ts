import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';
import type {
  OAuthProfile,
  OAuthProvider,
  OAuthProviderMeta,
} from '../oauth-provider.interface';
import { GOOGLE_CONFIG } from '../../../config/app-config.module';
import type { GoogleConfig } from '../../../config/app.config';

const GOOGLE_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
]);

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

@Injectable()
export class GoogleService implements OAuthProvider, OnModuleInit {
  readonly meta: OAuthProviderMeta = {
    name: 'google',
    displayName: 'Google',
    configKey: 'GOOGLE_CLIENT_ID',
    enabled: false,
    startUrl: '/auth/google/start',
  };

  private readonly logger = new Logger(GoogleService.name);
  private client: OAuth2Client | null = null;

  constructor(
    @Inject(GOOGLE_CONFIG) private readonly google: GoogleConfig,
  ) {}

  onModuleInit(): void {
    const { clientId, clientSecret, redirectUri } = this.google;
    if (!clientId || !clientSecret || !redirectUri) {
      this.meta.enabled = false;
      this.logger.warn(
        'Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI). Login is disabled.',
      );
      return;
    }
    this.client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.meta.enabled = true;
    this.logger.log('Google login enabled.');
  }

  buildAuthorizationUrl(state: string): string {
    if (!this.client) {
      throw new UnauthorizedException('Google login is not configured');
    }
    return this.client.generateAuthUrl({
      access_type: 'online',
      scope: GOOGLE_SCOPES,
      state,
      prompt: 'select_account',
      redirect_uri: this.google.redirectUri,
      include_granted_scopes: true,
    });
  }

  async exchangeAndVerify(code: string): Promise<OAuthProfile> {
    if (!this.client) {
      throw new UnauthorizedException('Google login is not configured');
    }
    if (!code || typeof code !== 'string') {
      throw new UnauthorizedException('authorization code is required');
    }
    let tokens;
    try {
      const result = await this.client.getToken({
        code,
        redirect_uri: this.google.redirectUri,
      });
      tokens = result.tokens;
    } catch (err) {
      throw new UnauthorizedException(
        `google code exchange failed: ${(err as Error).message}`,
      );
    }
    if (!tokens.id_token) {
      throw new UnauthorizedException('google token response missing id_token');
    }
    return this.verifyIdTokenAndBuild(tokens.id_token);
  }

  private async verifyIdTokenAndBuild(idToken: string): Promise<OAuthProfile> {
    if (!this.client) {
      throw new UnauthorizedException('Google login is not configured');
    }
    let ticket;
    try {
      ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.google.clientId,
      });
    } catch (err) {
      throw new UnauthorizedException(
        `google id_token verification failed: ${(err as Error).message}`,
      );
    }
    const claims = ticket.getPayload();
    if (!claims) {
      throw new UnauthorizedException('google id_token has no payload');
    }
    this.assertClaims(claims);
    return this.toProfile(claims);
  }

  private assertClaims(claims: TokenPayload): void {
    if (!GOOGLE_ISSUERS.has(claims.iss)) {
      throw new UnauthorizedException('invalid google issuer');
    }
    if (claims.aud !== this.google.clientId) {
      throw new UnauthorizedException('invalid google audience');
    }
    if (!claims.sub) {
      throw new UnauthorizedException('google id_token has no subject');
    }
    if (claims.email_verified !== true) {
      throw new UnauthorizedException('google email is not verified');
    }
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('google id_token expired');
    }
  }

  private toProfile(claims: TokenPayload): OAuthProfile {
    return {
      provider: 'google',
      providerSub: claims.sub,
      email: claims.email ?? null,
      emailVerified: claims.email_verified === true,
      displayName: claims.name ?? claims.email ?? 'Google User',
      picture: claims.picture ?? null,
    };
  }
}
