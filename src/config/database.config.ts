import { registerAs } from '@nestjs/config';

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  ssl: parseBoolean(process.env.DATABASE_SSL, false),
}));
