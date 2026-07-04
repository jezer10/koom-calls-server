import { registerAs } from '@nestjs/config';

function parseInteger(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export default registerAs('rateLimit', () => ({
  socketPerSecond: parseInteger(process.env.RATE_LIMIT_SOCKET_PER_SECOND, 20),
  userPerSecond: parseInteger(process.env.RATE_LIMIT_USER_PER_SECOND, 10),
  ipPerSecond: parseInteger(process.env.RATE_LIMIT_IP_PER_SECOND, 30),
  socketBurst: parseInteger(process.env.RATE_LIMIT_SOCKET_BURST, 5),
  userBurst: parseInteger(process.env.RATE_LIMIT_USER_BURST, 3),
  ipBurst: parseInteger(process.env.RATE_LIMIT_IP_BURST, 8),
}));
