import {
  Injectable,
  Logger,
  NestMiddleware,
  Optional,
  Inject,
} from '@nestjs/common';
import type { Server as IoServer, Socket as IoSocket } from 'socket.io';
import {
  verify,
  JwtPayload,
  VerifyOptions,
  sign,
  SignOptions,
} from 'jsonwebtoken';
import { z } from 'zod';

export const DEFAULT_JWT_SECRET = 'dev-secret-change-me';

export const WsAuthMiddlewareOptions = 'WS_AUTH_MIDDLEWARE_OPTIONS';

export interface WsAuthOptions {
  secret?: string;
  algorithms?: VerifyOptions['algorithms'];
  issuer?: string;
  audience?: string;
  clockTolerance?: number;
  userIdClaim?: string;
  requiredClaims?: ReadonlyArray<string>;
}

export const defaultWsAuthOptions: Required<
  Pick<
    WsAuthOptions,
    'secret' | 'userIdClaim' | 'algorithms' | 'clockTolerance'
  >
> & {
  issuer?: string;
  audience?: string;
  requiredClaims: ReadonlyArray<string>;
} = {
  secret: DEFAULT_JWT_SECRET,
  algorithms: ['HS256'],
  clockTolerance: 5,
  userIdClaim: 'sub',
  requiredClaims: [],
};

const TOKEN_SOURCE = {
  HANDSHAKE_AUTH: 'handshake.auth.token',
  AUTH_HEADER: 'Authorization',
  QUERY_TOKEN: 'query.token',
} as const;

const handshakeAuthSchema = z
  .object({
    token: z.string().min(1).optional(),
  })
  .passthrough();

const handshakeHeadersSchema = z
  .object({
    authorization: z.string().optional(),
  })
  .passthrough();

const handshakeQuerySchema = z
  .object({
    token: z.string().min(1).optional(),
  })
  .passthrough();

export interface WsAuthSuccess {
  ok: true;
  userId: string;
  jwt: string;
  payload: JwtPayload | string;
  source: keyof typeof TOKEN_SOURCE;
}

export interface WsAuthFailure {
  ok: false;
  reason: string;
  source?: keyof typeof TOKEN_SOURCE;
}

export type WsAuthResult = WsAuthSuccess | WsAuthFailure;

export type SocketIoNext = (err?: Error) => void;

export interface SocketLike {
  id: string;
  handshake: {
    auth?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    query?: Record<string, unknown>;
    address?: string;
  };
  data: Record<string, unknown>;
}

@Injectable()
export class WsAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WsAuthMiddleware.name);
  private readonly secret: string;
  private readonly algorithms: VerifyOptions['algorithms'];
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly clockTolerance: number;
  private readonly userIdClaim: string;
  private readonly requiredClaims: ReadonlyArray<string>;

  constructor(
    @Optional() @Inject(WsAuthMiddlewareOptions) options?: WsAuthOptions,
  ) {
    const resolved: WsAuthOptions = {
      secret: options?.secret ?? process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET,
      algorithms: options?.algorithms ?? defaultWsAuthOptions.algorithms,
      issuer: options?.issuer,
      audience: options?.audience,
      clockTolerance:
        options?.clockTolerance ?? defaultWsAuthOptions.clockTolerance,
      userIdClaim: options?.userIdClaim ?? defaultWsAuthOptions.userIdClaim,
      requiredClaims: options?.requiredClaims ?? [],
    };
    this.secret = resolved.secret as string;
    this.algorithms = resolved.algorithms;
    this.issuer = resolved.issuer;
    this.audience = resolved.audience;
    this.clockTolerance = resolved.clockTolerance ?? 5;
    this.userIdClaim = resolved.userIdClaim ?? 'sub';
    this.requiredClaims = resolved.requiredClaims ?? [];
  }

  use(socket: SocketLike, next: SocketIoNext): void {
    this.handle(socket, next);
  }

  forSocketIo() {
    return (socket: SocketLike, next: SocketIoNext): void => {
      this.handle(socket, next);
    };
  }

  forIoServer(server: IoServer): void {
    server.use(this.forSocketIo());
  }

  authenticate(socket: SocketLike): WsAuthResult {
    const extracted = this.extractToken(socket);
    if (!extracted) {
      return { ok: false, reason: 'missing_token' };
    }
    return this.verifyToken(extracted.token, extracted.source);
  }

  handle(socket: SocketLike, next: SocketIoNext): void {
    const result = this.authenticate(socket);
    if (!result.ok) {
      this.logger.warn(
        `auth failure socket=${socket.id} reason=${result.reason}${result.source ? ` source=${TOKEN_SOURCE[result.source]}` : ''}`,
      );
      next(new Error('unauthorized'));
      return;
    }
    socket.data.userId = result.userId;
    socket.data.jwt = result.jwt;
    socket.data.authSource = TOKEN_SOURCE[result.source];
    next();
  }

  private extractToken(
    socket: SocketLike,
  ): { token: string; source: keyof typeof TOKEN_SOURCE } | null {
    const authParsed = handshakeAuthSchema.safeParse(socket.handshake.auth);
    if (authParsed.success) {
      const token = authParsed.data.token;
      if (token) return { token, source: 'HANDSHAKE_AUTH' };
    }
    const headersParsed = handshakeHeadersSchema.safeParse(
      socket.handshake.headers,
    );
    if (headersParsed.success) {
      const raw = headersParsed.data.authorization;
      if (raw) {
        const match = /^Bearer\s+(.+)$/i.exec(raw);
        if (match && match[1]) {
          return { token: match[1], source: 'AUTH_HEADER' };
        }
      }
    }
    const queryParsed = handshakeQuerySchema.safeParse(socket.handshake.query);
    if (queryParsed.success) {
      const token = queryParsed.data.token;
      if (token) return { token, source: 'QUERY_TOKEN' };
    }
    return null;
  }

  private verifyToken(
    token: string,
    source: keyof typeof TOKEN_SOURCE,
  ): WsAuthResult {
    const verifyOpts: VerifyOptions = {
      algorithms: this.algorithms,
      clockTolerance: this.clockTolerance,
    };
    if (this.issuer) verifyOpts.issuer = this.issuer;
    if (this.audience) verifyOpts.audience = this.audience;

    let payload: JwtPayload | string;
    try {
      payload = verify(token, this.secret, verifyOpts);
    } catch (err) {
      const reason =
        err instanceof Error ? classifyJwtError(err) : 'invalid_token';
      return { ok: false, reason, source };
    }

    if (typeof payload === 'string') {
      return { ok: false, reason: 'invalid_payload', source };
    }

    for (const claim of this.requiredClaims) {
      if (!(claim in payload)) {
        return { ok: false, reason: `missing_claim:${claim}`, source };
      }
    }

    const userIdRaw = (payload as Record<string, unknown>)[this.userIdClaim];
    const userId =
      typeof userIdRaw === 'string'
        ? userIdRaw
        : typeof userIdRaw === 'number'
          ? String(userIdRaw)
          : null;
    if (!userId) {
      return { ok: false, reason: 'missing_user_id', source };
    }

    return { ok: true, userId, jwt: token, payload, source };
  }
}

function classifyJwtError(err: Error): string {
  const name = err.name || '';
  if (name === 'TokenExpiredError') return 'expired_token';
  if (name === 'NotBeforeError') return 'inactive_token';
  if (name === 'JsonWebTokenError') return 'malformed_token';
  if (name === 'InvalidAlgorithmError') return 'invalid_algorithm';
  return 'invalid_token';
}

export function signTestToken(
  payload: Record<string, unknown>,
  secret: string,
  options: { expiresIn?: string | number; algorithm?: string } = {},
): string {
  const signOptions: SignOptions = {
    algorithm: (options.algorithm as SignOptions['algorithm']) ?? 'HS256',
  };
  if (options.expiresIn !== undefined) {
    if (typeof options.expiresIn === 'number' && options.expiresIn < 0) {
      const expInPast = Math.floor(Date.now() / 1000) + options.expiresIn;
      const rest = { ...payload } as Record<string, unknown>;
      delete rest.iat;
      delete rest.exp;
      return sign({ ...rest, exp: expInPast }, secret, signOptions);
    }
    if (typeof options.expiresIn === 'number') {
      signOptions.expiresIn = options.expiresIn;
    } else {
      signOptions.expiresIn = options.expiresIn as unknown as number;
    }
  }
  return sign(payload, secret, signOptions);
}

export type WsAuthSocket = IoSocket;
