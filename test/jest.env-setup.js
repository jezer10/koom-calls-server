process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://koom:koom@localhost:5432/koom_test';
process.env.TURN_URL = process.env.TURN_URL ?? 'turn:turn.example.com:3478';
process.env.TURN_SHARED_SECRET =
  process.env.TURN_SHARED_SECRET ?? 'dev-turn-secret';
process.env.TURN_TTL = process.env.TURN_TTL ?? '3600';
process.env.TURN_REALM = process.env.TURN_REALM ?? 'koom.local';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret';
