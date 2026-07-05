import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedUser } from './authenticated-user';
import {
  AuthService,
  type SignInResult,
  type WsTokenResult,
} from './auth.service';
import { OAuthProvidersRegistry } from './providers/oauth-providers.registry';
import { WsTokenService } from './ws/ws-token.service';

interface AuthedRequest extends Request {
  user?: AuthenticatedUser;
}

const STATE_COOKIE = 'oauth_state';
const RETURNTO_COOKIE = 'oauth_returnto';
const SESSION_COOKIE = 'koom_session';
const COOKIE_PATH_OAUTH = '/auth/google';
const COOKIE_PATH_SESSION = '/';
const STATE_TTL_SECONDS = 600;
const SESSION_TTL_SECONDS = 3600;

const anonymousLoginDto = z.object({
  displayName: z.string().min(1).max(255).optional(),
});

function parseAnonymousDto(body: unknown): { displayName?: string } {
  const result = anonymousLoginDto.safeParse(body ?? {});
  if (!result.success) {
    throw new BadRequestException(
      `invalid body: ${result.error.issues.map((i) => i.message).join('; ')}`,
    );
  }
  return result.data;
}

function setOauthCookies(
  res: Response,
  state: string,
  returnTo: string,
  secure: boolean,
): void {
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: STATE_TTL_SECONDS * 1000,
    path: COOKIE_PATH_OAUTH,
  });
  if (returnTo) {
    res.cookie(RETURNTO_COOKIE, returnTo, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: STATE_TTL_SECONDS * 1000,
      path: COOKIE_PATH_OAUTH,
    });
  }
}

function clearOauthCookies(res: Response): void {
  res.clearCookie(STATE_COOKIE, { path: COOKIE_PATH_OAUTH });
  res.clearCookie(RETURNTO_COOKIE, { path: COOKIE_PATH_OAUTH });
}

function setSessionCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: COOKIE_PATH_SESSION,
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: COOKIE_PATH_SESSION });
}

function safeReturnTo(returnTo: string | undefined): string {
  if (!returnTo) return '';
  if (returnTo.length > 2048) return '';
  if (!returnTo.startsWith('/')) return '';
  if (returnTo.startsWith('//')) return '';
  return returnTo;
}

function popupHtml(
  payload: Record<string, unknown>,
  targetOrigin: string,
): string {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Authenticating…</title></head><body><script>(function(){
    function done(){ try { window.close(); } catch (e) {} }
    try {
      var d=${json};
      if (window.opener) {
        window.opener.postMessage(d, ${JSON.stringify(targetOrigin)});
        setTimeout(done, 200);
      } else {
        document.body.textContent='Authentication complete. You may close this window.';
      }
    } catch (e) {
      document.body.textContent='Authentication failed: '+(e&&e.message||'unknown');
    }
  }());</script></body></html>`;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly registry: OAuthProvidersRegistry,
    private readonly wsTokens: WsTokenService,
  ) {}

  @Get('providers')
  listProviders() {
    const providers = this.registry.list().filter((p) => p.enabled);
    providers.push({
      name: 'anonymous',
      displayName: 'Guest',
      enabled: true,
      startUrl: '/auth/anonymous/login',
    });
    return { providers };
  }

  @Get('google/start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  googleStart(
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ) {
    const state = randomState();
    const safeReturn = safeReturnTo(returnTo);
    setOauthCookies(res, state, safeReturn, this.auth.getCookieSecure());
    const provider = this.registry.get('google');
    if (!provider || !provider.meta.enabled) {
      throw new NotFoundException('google provider not registered');
    }
    const url = provider.buildAuthorizationUrl(state);
    res.redirect(302, url);
  }

  @Get('google/callback')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    const frontendOrigin = this.auth.getFrontendOrigin() || '*';
    const cookies = req.cookies as Record<string, string> | undefined;
    const expectedState: string = cookies?.[STATE_COOKIE] ?? '';
    const returnTo = cookies?.[RETURNTO_COOKIE] ?? '';
    clearOauthCookies(res);

    if (error) {
      this.auth.logOauthFailure('google', 'google_error');
      const html = popupHtml(
        { type: 'koom-oauth-error', message: error, returnTo },
        frontendOrigin,
      );
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(400).send(html);
      return;
    }
    if (!state || !expectedState || state !== expectedState) {
      this.auth.logOauthFailure('google', 'state_mismatch');
      const html = popupHtml(
        { type: 'koom-oauth-error', message: 'state mismatch', returnTo },
        frontendOrigin,
      );
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(400).send(html);
      return;
    }
    if (!code) {
      this.auth.logOauthFailure('google', 'missing_code');
      const html = popupHtml(
        { type: 'koom-oauth-error', message: 'missing code', returnTo },
        frontendOrigin,
      );
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(400).send(html);
      return;
    }
    try {
      const { user, token } = await this.auth.completeOAuth('google', code);
      setSessionCookie(res, token, this.auth.getCookieSecure());
      const html = popupHtml(
        {
          type: 'koom-oauth-success',
          token,
          user: {
            userId: user.id,
            displayName: user.displayName,
            email: user.email,
            picture: user.picture,
            provider: user.provider,
          },
          returnTo,
        },
        frontendOrigin,
      );
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch (err) {
      const message =
        (err as { message?: string })?.message ?? 'authentication failed';
      this.auth.logOauthFailure('google', 'verify_failed');
      const html = popupHtml(
        { type: 'koom-oauth-error', message, returnTo },
        frontendOrigin,
      );
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(401).send(html);
    }
  }

  @Post('anonymous/login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async anonymousLogin(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<SignInResult, 'token'>> {
    const dto = parseAnonymousDto(body);
    const userId = `anon-${randomShortId()}`;
    const displayName = dto.displayName ?? 'Guest';
    const result = await this.auth.signInAnonymous(userId, displayName);
    setSessionCookie(res, result.token, this.auth.getCookieSecure());
    const { token: _omit, ...payload } = result;
    return payload;
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    if (!req.user) {
      throw new NotFoundException('authenticated user missing');
    }
    return this.auth.getProfile(req.user.userId);
  }

  @Get('ws-token')
  @UseGuards(JwtAuthGuard)
  wsToken(@Req() req: AuthedRequest): WsTokenResult {
    if (!req.user) {
      throw new NotFoundException('authenticated user missing');
    }
    return this.wsTokens.issue(req.user.userId);
  }
}

function randomState(): string {
  const bytes = new Uint8Array(32);
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  return Buffer.from(bytes).toString('base64url');
}

function randomShortId(): string {
  return Math.random().toString(36).slice(2, 10);
}
