import { ConfigModule } from '@nestjs/config';
import type { DynamicModule } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { envValidationSchema } from '../env.schema';

export function buildTestingConfigModule(
  overrides: Record<string, unknown> = {},
): Promise<DynamicModule> {
  return Promise.resolve(
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validationSchema: envValidationSchema,
      load: [
        () => ({
          DATABASE_URL: 'postgres://koom:test@db:5432/koom_test',
          ...overrides,
        }),
      ],
    }),
  );
}

describe('config test pattern', () => {
  it('builds a ConfigModule using the Joi validation schema', async () => {
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
