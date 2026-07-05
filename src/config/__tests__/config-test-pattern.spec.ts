import { ConfigModule } from '@nestjs/config';
import type { DynamicModule } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { envValidationSchema } from '../env.schema';

export function buildTestingConfigModule(
  overrides: NodeJS.ProcessEnv = {},
): DynamicModule {
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    DATABASE_URL: 'postgres://koom:test@db:5432/koom_test',
    ...overrides,
  };
  const module = ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true,
    validationSchema: envValidationSchema,
  });
  process.env = originalEnv;
  return module;
}

describe('config test pattern', () => {
  it('builds a ConfigModule using the Joi validation schema', () => {
    const mod = buildTestingConfigModule({
      JWT_SECRET: 'unit-test-secret',
    });
    expect(mod).toBeDefined();
  });

  it('builds a TestingModule with the standard config provider', async () => {
    const testing = await Test.createTestingModule({
      imports: [buildTestingConfigModule()],
    }).compile();
    expect(testing).toBeDefined();
    await testing.close();
  });
});
