import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  const configService = app.get(ConfigService);
  const corsOrigin = parseCorsOrigin(
    configService.get<string | string[]>('CORS_ORIGIN'),
  );
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const redisUrl = configService.get<string>('REDIS_URL') ?? undefined;
  const wsAdapter = new SocketIoRedisAdapter(app, { redisUrl });
  app.useWebSocketAdapter(wsAdapter);

  const httpPort = configService.getOrThrow<number>('PORT');
  const signalingNamespace = configService.getOrThrow<string>(
    'SIGNALING_NAMESPACE',
  );

  await app.listen(httpPort);

  logger.log(`Signaling server listening on http://localhost:${httpPort}`);
  logger.log(`Socket.IO signaling: ${signalingNamespace} (path /socket.io)`);
}

if (require.main === module) {
  void bootstrap();
}
