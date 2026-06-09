import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { runSeed } from './dev.seed';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await AppDataSource.synchronize();
    await runSeed(AppDataSource);

    console.log('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
