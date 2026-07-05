import { registerAs } from '@nestjs/config';

function parseInteger(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function parseList(
  raw: string | undefined,
  fallback: string[],
): string[] {
  if (raw === undefined || raw === '') return fallback;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export default registerAs('turn', () => ({
  url: process.env.TURN_URL ?? '',
  sharedSecret: process.env.TURN_SHARED_SECRET ?? '',
  ttlSeconds: parseInteger(process.env.TURN_TTL, 3600),
  tokenTtlSeconds: parseInteger(process.env.TURN_TOKEN_TTL_SECONDS, 3600),
  realm: process.env.TURN_REALM ?? 'koom.local',
  stunUrls: parseList(process.env.TURN_STUN_URLS, [
    'stun:stun.l.google.com:19302',
  ]),
  urls: parseList(process.env.TURN_URLS, [
    'turn:turn.koom.example.com:3478?transport=udp',
    'turn:turn.koom.example.com:3478?transport=tcp',
  ]),
}));
