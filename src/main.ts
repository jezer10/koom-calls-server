import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

import { AppModule, SocketIoRedisAdapter } from './app.module';

function parseCorsOrigin(
  raw: string | string[] | undefined,
): string | string[] {
  if (raw === undefined) return '*';
  return raw;
}

export async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    cors: false,
  });

  app.use(cookieParser());

  app.setGlobalPrefix('api', {
    exclude: [
      '/',
      '/info',
      '/info/(.*)',
      '/metrics',
      '/health',
      // Google redirects to this URL verbatim (the configured
      // GOOGLE_REDIRECT_URI). It must NOT be prefixed with /api or
      // Google will throw a redirect_uri_mismatch on the next step.
      '/auth/google/(.*)',
    ],
  });

  const config = app.get(ConfigService);
  const httpPort = config.getOrThrow<number>('app.port');
  const namespace = config.getOrThrow<string>('signaling.namespace');
  const corsOrigin = config.get<string>('app.corsOrigin') ?? '*';
  const redisUrl = config.get<string>('redis.url') ?? '';
  app.enableCors({
    origin: parseCorsOrigin(corsOrigin),
    credentials: true,
  });

  const wsAdapter = new SocketIoRedisAdapter(app, {
    redisUrl: redisUrl || undefined,
  });
  app.useWebSocketAdapter(wsAdapter);

  await app.listen(httpPort);

  logger.log(`Signaling server listening on http://localhost:${httpPort}`);
  logger.log(`Socket.IO signaling: ${namespace} (path /socket.io)`);
}

if (require.main === module) {
  void bootstrap();
}
