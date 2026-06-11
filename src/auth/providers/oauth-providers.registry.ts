import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  OAUTH_PROVIDERS,
  type OAuthProvider,
  type OAuthProviderMeta,
  type OAuthProvidersMap,
} from './oauth-provider.interface';

@Injectable()
export class OAuthProvidersRegistry {
  constructor(
    @Optional()
    @Inject(OAUTH_PROVIDERS)
    private readonly providers: OAuthProvidersMap | null,
  ) {}

  list(): OAuthProviderMeta[] {
    if (!this.providers) return [];
    return Array.from(this.providers.values())
      .filter((p) => p.meta.enabled)
      .map((p) => ({
        ...p.meta,
      }));
  }

  get(name: string): OAuthProvider | undefined {
    return this.providers?.get(name);
  }
}
