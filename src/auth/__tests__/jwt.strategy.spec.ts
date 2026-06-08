import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import {
  JwtStrategy,
  resolveJwtSecret,
  type JwtPayload,
} from '../jwt.strategy';

const SECRET = 'test-jwt-secret-please-change';

describe('JwtStrategy', () => {
  const originalEnv = { ...process.env };
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    strategy = new JwtStrategy();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('resolveJwtSecret', () => {
    it('returns the secret from the env', () => {
      expect(resolveJwtSecret({ JWT_SECRET: 'abc' })).toBe('abc');
    });

    it('throws when the secret is missing', () => {
      expect(() => resolveJwtSecret({})).toThrow(/JWT_SECRET/);
    });

    it('throws when the secret is empty', () => {
      expect(() => resolveJwtSecret({ JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
    });
  });

  describe('validate()', () => {
    it('returns a user object with userId == sub', () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'user-1@example.com',
      };
      const user = strategy.validate(payload);
      expect(user.userId).toBe('user-1');
      expect(user.sub).toBe('user-1');
      expect(user.email).toBe('user-1@example.com');
    });

    it('throws UnauthorizedException for missing sub', () => {
      expect(() =>
        strategy.validate({ email: 'no-sub@example.com' } as JwtPayload),
      ).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for empty sub', () => {
      expect(() => strategy.validate({ sub: '' })).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('integration: full token validation', () => {
    it('signs and verifies a token round-trip', () => {
      const token = jwt.sign({ sub: 'u-7', email: 'u-7@example.com' }, SECRET, {
        expiresIn: '1h',
      });
      const decoded = jwt.verify(token, SECRET) as JwtPayload;
      const user = strategy.validate(decoded);
      expect(user.userId).toBe('u-7');
      expect(user.email).toBe('u-7@example.com');
    });

    it('rejects a token signed with a different secret', () => {
      const token = jwt.sign({ sub: 'u-7' }, 'a-completely-different-secret', {
        expiresIn: '1h',
      });
      expect(() => jwt.verify(token, SECRET)).toThrow();
    });
  });
});
