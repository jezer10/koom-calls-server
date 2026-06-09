import { redactPayload, isRedactedKey, __test__ } from '../redaction.util';

describe('redaction.util', () => {
  describe('redactPayload()', () => {
    it('strips sdp, iceCandidates, password, token keys', () => {
      const input = {
        sdp: 'v=0...',
        iceCandidates: [{ candidate: 'cand-1' }],
        password: 'super-secret',
        token: 'jwt-token',
      };
      const out = redactPayload(input) as Record<string, unknown>;

      expect(out.sdp).toBe('[REDACTED]');
      expect(out.iceCandidates).toBe('[REDACTED]');
      expect(out.password).toBe('[REDACTED]');
      expect(out.token).toBe('[REDACTED]');
    });

    it('strips authorization and candidate keys at any depth', () => {
      const input = {
        a: {
          b: {
            authorization: 'Bearer xxx',
            candidate: 'cand-1',
            keep: 'ok',
          },
        },
      };
      const out = redactPayload(input) as { a: { b: Record<string, unknown> } };
      expect(out.a.b.authorization).toBe('[REDACTED]');
      expect(out.a.b.candidate).toBe('[REDACTED]');
      expect(out.a.b.keep).toBe('ok');
    });

    it('truncates long strings to 256 characters', () => {
      const long = 'x'.repeat(1024);
      const out = redactPayload({ message: long }) as Record<string, unknown>;
      const message = out.message as string;
      expect(message.length).toBeLessThanOrEqual(256);
      expect(message.endsWith('…')).toBe(true);
      expect(message.startsWith('x')).toBe(true);
    });

    it('preserves short strings verbatim', () => {
      const out = redactPayload({ msg: 'hi' }) as Record<string, unknown>;
      expect(out.msg).toBe('hi');
    });

    it('keeps non-string primitives intact', () => {
      const out = redactPayload({ n: 42, b: true, x: null }) as Record<
        string,
        unknown
      >;
      expect(out.n).toBe(42);
      expect(out.b).toBe(true);
      expect(out.x).toBeNull();
    });

    it('walks arrays and redacts nested entries', () => {
      const out = redactPayload({
        list: [{ token: 't1', sdp: 's1' }, { token: 't2' }],
      }) as { list: Array<Record<string, unknown>> };
      expect(out.list[0]?.token).toBe('[REDACTED]');
      expect(out.list[0]?.sdp).toBe('[REDACTED]');
      expect(out.list[1]?.token).toBe('[REDACTED]');
    });

    it('handles circular references without infinite loop', () => {
      const a: Record<string, unknown> = { name: 'a' };
      a.self = a;
      const out = redactPayload(a) as Record<string, unknown>;
      expect(out.name).toBe('a');
      expect(out.self).toBe('[CIRCULAR]');
    });

    it('honors custom maxStringLength', () => {
      const out = redactPayload(
        { msg: 'abcdefghij' },
        { maxStringLength: 4 },
      ) as Record<string, unknown>;
      expect(out.msg).toBe('abc…');
    });

    it('honors custom placeholder', () => {
      const out = redactPayload(
        { token: 'x' },
        { redactionPlaceholder: '***' },
      ) as Record<string, unknown>;
      expect(out.token).toBe('***');
    });

    it('adds extra redacted keys via options', () => {
      const out = redactPayload(
        { customSecret: 'shh', keep: 'ok' },
        { extraRedactedKeys: new Set(['customSecret']) },
      ) as Record<string, unknown>;
      expect(out.customSecret).toBe('[REDACTED]');
      expect(out.keep).toBe('ok');
    });

    it('returns null/undefined for null/undefined input', () => {
      expect(redactPayload(null)).toBeNull();
      expect(redactPayload(undefined)).toBeUndefined();
    });

    it('handles top-level primitive inputs', () => {
      expect(redactPayload(42)).toBe(42);
      expect(redactPayload(true)).toBe(true);
    });
  });

  describe('isRedactedKey()', () => {
    it('returns true for known sensitive keys', () => {
      expect(isRedactedKey('sdp')).toBe(true);
      expect(isRedactedKey('iceCandidates')).toBe(true);
      expect(isRedactedKey('candidate')).toBe(true);
      expect(isRedactedKey('password')).toBe(true);
      expect(isRedactedKey('token')).toBe(true);
      expect(isRedactedKey('authorization')).toBe(true);
    });

    it('returns false for normal keys', () => {
      expect(isRedactedKey('userId')).toBe(false);
      expect(isRedactedKey('roomId')).toBe(false);
    });
  });

  describe('__test__ truncate', () => {
    it('returns the same string when under limit', () => {
      expect(__test__.truncate('hi', 10)).toBe('hi');
    });

    it('truncates and appends ellipsis when over limit', () => {
      const result = __test__.truncate('abcdefghij', 4);
      expect(result).toBe('abc…');
    });
  });
});
