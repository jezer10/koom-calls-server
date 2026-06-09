import {
  StructuredLoggerService,
  structuredLoggerRedaction,
  REDACT_VALUE,
  REDACT_PATHS,
} from '../structured-logger.service';
import type { PinoLogger as PinoLoggerType } from 'nestjs-pino';

interface FakePinoLike {
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
  child: (context: unknown) => FakePinoLike;
}

interface FakePinoRoot extends FakePinoLike {
  logger: FakePinoLike;
}

interface CapturedEntry {
  level: number;
  args: unknown[];
}

function createPinoStub(): {
  root: FakePinoRoot;
  childLoggers: Array<{ context: unknown; entries: CapturedEntry[] }>;
} {
  const childLoggers: Array<{ context: unknown; entries: CapturedEntry[] }> =
    [];

  const make = (parentEntries: CapturedEntry[]): FakePinoLike => {
    const stub: FakePinoLike = {
      trace: (...args) => parentEntries.push({ level: 10, args }),
      debug: (...args) => parentEntries.push({ level: 20, args }),
      info: (...args) => parentEntries.push({ level: 30, args }),
      warn: (...args) => parentEntries.push({ level: 40, args }),
      error: (...args) => parentEntries.push({ level: 50, args }),
      fatal: (...args) => parentEntries.push({ level: 60, args }),
      child: (context: unknown) => {
        const childEntries: CapturedEntry[] = [];
        childLoggers.push({ context, entries: childEntries });
        return make(childEntries);
      },
    };
    return stub;
  };

  const rootEntries: CapturedEntry[] = [];
  const root = make(rootEntries) as FakePinoRoot;
  root.logger = root;
  return { root, childLoggers };
}

describe('StructuredLoggerService', () => {
  it('forwards log/warn/error/debug/verbose/fatal to the underlying pino logger', () => {
    const { root } = createPinoStub();
    const service = new StructuredLoggerService(
      root as unknown as PinoLoggerType,
    );

    const rootEntries: CapturedEntry[] = [];
    root.info = (...args: unknown[]) => rootEntries.push({ level: 30, args });
    root.warn = (...args: unknown[]) => rootEntries.push({ level: 40, args });
    root.error = (...args: unknown[]) => rootEntries.push({ level: 50, args });
    root.debug = (...args: unknown[]) => rootEntries.push({ level: 20, args });
    root.trace = (...args: unknown[]) => rootEntries.push({ level: 10, args });
    root.fatal = (...args: unknown[]) => rootEntries.push({ level: 60, args });

    service.log('hello');
    service.warn('careful');
    service.error('boom');
    service.debug('deep');
    service.verbose('trace-me');
    service.fatal('dead');

    const levels = rootEntries.map((e) => e.level);
    expect(levels).toEqual([30, 40, 50, 20, 10, 60]);
    expect(rootEntries[0].args[0]).toBe('hello');
  });

  it('wraps extra params into a meta object when present', () => {
    const { root } = createPinoStub();
    const service = new StructuredLoggerService(
      root as unknown as PinoLoggerType,
    );
    const captured: CapturedEntry[] = [];
    root.info = (...args: unknown[]) => captured.push({ level: 30, args });

    service.log('event happened', { foo: 'bar' }, 99);
    expect(captured[0].args[0]).toEqual({
      msg: 'event happened',
      meta: [{ foo: 'bar' }, 99],
    });
  });

  it('child() returns a logger bound with the provided context', () => {
    const { root, childLoggers } = createPinoStub();
    const service = new StructuredLoggerService(
      root as unknown as PinoLoggerType,
    );

    const child = service.child({ callId: 'call-1', userId: 'user-7' });
    child.info('joined');

    expect(childLoggers).toHaveLength(1);
    expect(childLoggers[0].context).toEqual({
      callId: 'call-1',
      userId: 'user-7',
    });
    expect(childLoggers[0].entries[0].args[0]).toBe('joined');
  });

  it('exposes a redaction configuration for pino', () => {
    expect(structuredLoggerRedaction.censor).toBe(REDACT_VALUE);
    expect(REDACT_VALUE).toBe('[REDACTED]');
    expect(REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'authorization',
        'token',
        'jwt',
        'sdp',
        'iceCandidates',
      ]),
    );
  });
});
