import * as jwt from 'jsonwebtoken';
import { loadConfig } from '../../src/config/app.config';

const DEFAULT_TEST_JWT_SECRET = 'dev-jwt-secret';

export interface TestJwtOptions {
  userId: string;
  expiresInSeconds?: number;
  secret?: string;
  issuer?: string;
}

export function signTestJwt(opts: TestJwtOptions): string {
  const config = loadConfig();
  const secret =
    opts.secret ?? process.env.JWT_SECRET ?? DEFAULT_TEST_JWT_SECRET;
  const issuer = opts.issuer ?? config.jwt.issuer;
  const expiresIn = opts.expiresInSeconds ?? 3600;
  return jwt.sign({ sub: opts.userId }, secret, {
    algorithm: 'HS256',
    issuer,
    expiresIn,
  });
}
