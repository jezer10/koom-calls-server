import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule, SocketIoRedisAdapter } from './app.module';
import { APP_CONFIG } from './config/app-config.module';
import type { AppConfig } from './config/app.config';

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

  const config = app.get<AppConfig>(APP_CONFIG);
  app.enableCors({
    origin: parseCorsOrigin(config.signaling.corsOrigin),
    credentials: true,
  });

  const wsAdapter = new SocketIoRedisAdapter(app, {
    redisUrl: config.redis.url || undefined,
  });
  app.useWebSocketAdapter(wsAdapter);

  await app.listen(config.httpPort);

  logger.log(
    `Signaling server listening on http://localhost:${config.httpPort}`,
  );
  logger.log(
    `Socket.IO signaling: ${config.signaling.namespace} (path /socket.io)`,
  );
}

if (require.main === module) {
  void bootstrap();
}
