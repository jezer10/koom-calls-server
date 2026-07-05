import { registerAs } from '@nestjs/config';
import type { NodeEnv } from './env.schema';

function parsePort(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 8080;
}

export default registerAs('app', () => ({
  port: parsePort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? '',
  logLevel: process.env.LOG_LEVEL ?? 'debug',
  nodeEnv: (process.env.NODE_ENV ?? 'development') as NodeEnv,
}));
