import { registerAs } from '@nestjs/config';

export default registerAs('signaling', () => ({
  namespace: process.env.SIGNALING_NAMESPACE ?? '/signaling',
}));
