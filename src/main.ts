import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule, SocketIoRedisAdapter } from './app.module';

export interface BootstrapOptions {
  enablePeerServer?: boolean;
}

function parseCorsOrigin(raw: string | string[] | undefined): string | string[] {
  if (raw === undefined) return '*';
  return raw;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<void> {
  const logger = new Logger('Bootstrap');
  const enablePeer = options.enablePeerServer ?? false;

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

  app.useWebSocketAdapter(app.get(SocketIoRedisAdapter));

  if (enablePeer) {
    // Lazy-load the legacy PeerJS wiring via require so the _deprecated
    // module is only pulled in when the legacy path is explicitly enabled.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const peerModule = require('./_deprecated/peer/peer-server') as {
      startPeerServer: (opts: {
        port: number;
        key: string;
        path: string;
        allowDiscovery: boolean;
        logger: (line: string) => void;
        errorLogger: (line: string) => void;
        exitLogger: (code: number | null) => void;
      }) => unknown;
    };
    peerModule.startPeerServer({
      port: configService.getOrThrow<number>('PEER_PORT'),
      key: configService.getOrThrow<string>('PEER_KEY'),
      path: configService.getOrThrow<string>('PEER_PATH'),
      allowDiscovery:
        configService.getOrThrow<boolean>('PEER_ALLOW_DISCOVERY'),
      logger: (line: string) => logger.log(`[peerjs] ${line}`),
      errorLogger: (line: string) => logger.error(`[peerjs] ${line}`),
      exitLogger: (code: number | null) =>
        logger.error(`[peerjs] exited with code ${code}`),
    });
  }

  const httpPort = configService.getOrThrow<number>('PORT');
  const signalingNamespace = configService.getOrThrow<string>(
    'SIGNALING_NAMESPACE',
  );

  await app.listen(httpPort);

  logger.log(`Signaling server listening on http://localhost:${httpPort}`);
  logger.log(
    `Socket.IO signaling: ${signalingNamespace} (path /socket.io)`,
  );
}

if (require.main === module) {
  void bootstrap();
}
