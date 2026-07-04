import { registerAs } from '@nestjs/config';

function parseInteger(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export default registerAs('presence', () => ({
  ttlSeconds: parseInteger(process.env.PRESENCE_TTL_SECONDS, 60),
}));
