import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwtStrategy, type JwtPayload } from '../jwt.strategy';

const SECRET = 'test-jwt-secret-please-change';

function makeConfigService(): ConfigService {
  return {
    getOrThrow: <T = string>(key: string): T => {
      if (key === 'JWT_SECRET') return SECRET as unknown as T;
      throw new Error(`unexpected key ${key}`);
    },
  } as unknown as ConfigService;
}

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy(makeConfigService());
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
