import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from './users.repository';
import { UserEntity } from './entities/user.entity';
import { AuthAuditLogger } from './auth-audit.logger';
import {
  OAUTH_PROVIDERS,
  type OAuthProfile,
  type OAuthProvider,
  type OAuthProvidersMap,
} from './providers/oauth-provider.interface';

export interface SignInResult {
  token: string;
  userId: string;
  displayName: string;
  email: string | null;
  picture: string | null;
  provider: string;
}

export interface WsTokenResult {
  token: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    private readonly audit: AuthAuditLogger,
    @Optional()
    @Inject(OAUTH_PROVIDERS)
    private readonly providers: OAuthProvidersMap | null,
    private readonly config: ConfigService,
  ) {}

  async startOAuth(name: string): Promise<string> {
    const provider = this.getProvider(name);
    if (!provider) {
      this.audit.log({ event: 'auth.oauth_start', provider: name, reason: 'unknown_provider' });
      throw new NotFoundException(`unknown provider: ${name}`);
    }
    if (!provider.meta.enabled) {
      this.audit.log({ event: 'auth.oauth_start', provider: name, reason: 'provider_disabled' });
      throw new NotFoundException(`provider disabled: ${name}`);
    }
    this.audit.log({ event: 'auth.oauth_start', provider: name });
    return provider.buildAuthorizationUrl('');
  }

  async completeOAuth(
    name: string,
    code: string,
  ): Promise<{ user: UserEntity; token: string }> {
    const provider = this.getProvider(name);
    if (!provider) {
      this.audit.log({
        event: 'auth.oauth_callback_failed',
        provider: name,
        reason: 'unknown_provider',
      });
      throw new NotFoundException(`unknown provider: ${name}`);
    }
    if (!provider.meta.enabled) {
      this.audit.log({
        event: 'auth.oauth_callback_failed',
        provider: name,
        reason: 'provider_disabled',
      });
      throw new NotFoundException(`provider disabled: ${name}`);
    }
    let profile: OAuthProfile;
    try {
      profile = await provider.exchangeAndVerify(code);
    } catch {
      this.audit.log({
        event: 'auth.oauth_callback_failed',
        provider: name,
        reason: 'verify_failed',
      });
      throw new UnauthorizedException('oauth verification failed');
    }
    const user = await this.users.upsertByProvider(profile);
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    this.audit.log({
      event: 'auth.oauth_callback_success',
      provider: name,
      userId: user.id,
    });
    return { user, token };
  }

  async signInAnonymous(userId: string, displayName: string): Promise<SignInResult> {
    const user = await this.users.upsertByProvider({
      provider: 'anonymous',
      providerSub: userId,
      email: null,
      emailVerified: true,
      displayName,
      picture: null,
    });
    const token = this.signSessionToken(user.id, user.email);
    this.audit.log({
      event: 'auth.anonymous_login_success',
      provider: 'anonymous',
      userId: user.id,
    });
    return {
      token,
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      picture: user.picture,
      provider: user.provider,
    };
  }

  signSessionToken(userId: string, email: string | null): string {
    return this.jwt.sign({ sub: userId, email });
  }

  logOauthFailure(provider: string, reason: string): void {
    this.audit.log({
      event: 'auth.oauth_callback_failed',
      provider,
      reason,
    });
  }

  async getProfile(userId: string): Promise<{
    userId: string;
    displayName: string;
    email: string | null;
    picture: string | null;
    provider: string;
    lastLoginAt: Date | null;
  }> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return this.toProfile(user);
  }

  isAnonymousLoginEnabled(): boolean {
    const flag = this.config.get<string>('AUTH_ANONYMOUS_LOGIN_ENABLED');
    if (flag === undefined || flag === null || flag === '') {
      return this.config.get<string>('NODE_ENV') !== 'production';
    }
    return flag === 'true' || flag === '1';
  }

  getFrontendOrigin(): string {
    return this.config.get<string>('FRONTEND_ORIGIN') ?? '';
  }

  isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  getCookieSecure(): boolean {
    return this.isProduction();
  }

  private getProvider(name: string): OAuthProvider | undefined {
    return this.providers?.get(name);
  }

  private toProfile(user: UserEntity) {
    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      picture: user.picture,
      provider: user.provider,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
