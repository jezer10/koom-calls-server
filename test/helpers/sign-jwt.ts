import * as jwt from 'jsonwebtoken';
import {
  DEFAULT_TEST_JWT_SECRET,
  loadConfig,
} from '../../src/config/app.config';

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
  const expiresIn = opts.expiresInSeconds ?? config.jwt.expiresInSeconds;
  return jwt.sign({ sub: opts.userId }, secret, {
    algorithm: 'HS256',
    issuer,
    expiresIn,
  });
}
