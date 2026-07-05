import * as jwt from 'jsonwebtoken';

const DEFAULT_TEST_JWT_SECRET = 'dev-jwt-secret';

export interface TestJwtOptions {
  userId: string;
  expiresInSeconds?: number;
  secret?: string;
  issuer?: string;
}

export function signTestJwt(opts: TestJwtOptions): string {
  const secret =
    opts.secret ?? process.env.JWT_SECRET ?? DEFAULT_TEST_JWT_SECRET;
  const issuer = opts.issuer ?? process.env.JWT_ISSUER;
  const expiresIn = opts.expiresInSeconds ?? 3600;
  const signOptions: jwt.SignOptions = {
    algorithm: 'HS256',
    expiresIn,
  };
  if (issuer) {
    signOptions.issuer = issuer;
  }
  return jwt.sign({ sub: opts.userId }, secret, signOptions);
}
