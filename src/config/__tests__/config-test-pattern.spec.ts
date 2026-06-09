import { ConfigModule } from '@nestjs/config';
import type { DynamicModule } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { parseEnv, type ParsedEnv } from '../env.schema';

/**
 * Reference pattern for unit tests in CONFIG-1..7 migrations.
 *
 * Tests should provide their own `ParsedEnv` object through
 * `ConfigModule.forRoot({ validate: () => parsedEnv })` rather than
 * mutating `process.env`. The returned object comes from the central
 * Zod schema so every test exercises the same validation surface that
 * the application uses at boot.
 *
 * Returns a `DynamicModule` promise so callers can `await` it from
 * `Test.createTestingModule({ imports: [...] })`.
 */
export function buildTestingConfigModule(
  overrides: Partial<ParsedEnv> = {},
): Promise<DynamicModule> {
  const parsed: ParsedEnv = parseEnv({});
  return Promise.resolve(
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: () => ({ ...parsed, ...overrides }),
    }),
  );
}

describe('config test pattern (CONFIG-8)', () => {
  it('parses a ParsedEnv via parseEnv() and feeds it to ConfigModule', async () => {
    expect(typeof parseEnv).toBe('function');
    const mod = await buildTestingConfigModule({
      JWT_SECRET: 'unit-test-secret',
    });
    expect(mod).toBeDefined();
  });

  it('builds a TestingModule with the standard config provider', async () => {
    const testing = await Test.createTestingModule({
      imports: [await buildTestingConfigModule()],
    }).compile();
    expect(testing).toBeDefined();
    await testing.close();
  });
});
