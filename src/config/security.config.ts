import { registerAs } from '@nestjs/config';

function parseInteger(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export default registerAs('security', () => ({
  sfuTokenTtlSeconds: parseInteger(process.env.SFU_TOKEN_TTL_SECONDS, 3600),
  turnTokenTtlSeconds: parseInteger(process.env.TURN_TOKEN_TTL_SECONDS, 3600),
}));
