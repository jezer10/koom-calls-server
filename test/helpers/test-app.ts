import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../../src/app.module';
import { CallsService, CallEventsStore } from '../../src/calls/calls.service';
import {
  TURN_SERVICE,
  TurnService,
  TurnCredentials,
  TurnCredentialsOptions,
} from '../../src/turn/turn.types';
import {
  SFU_SERVICE,
  SfuService,
  SfuToken,
  SfuTokenRequest,
} from '../../src/sfu/sfu.types';

export interface FakeTurnService extends TurnService {
  calls: TurnCredentialsOptions[];
  next: TurnCredentials;
}

export interface FakeSfuService extends SfuService {
  calls: SfuTokenRequest[];
  next: SfuToken;
}

export interface BootstrappedApp {
  app: INestApplication;
  baseUrl: string;
  namespace: string;
  callsService: CallsService;
  eventsStore: CallEventsStore;
  turnService: FakeTurnService;
  sfuService: FakeSfuService;
  close: () => Promise<void>;
}

export interface BootstrapTestAppOptions {
  skipPeerServer?: boolean;
  turn?: TurnService;
  sfu?: SfuService;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function bootstrapTestApp(
  options: BootstrapTestAppOptions = {},
): Promise<BootstrappedApp> {
  const namespace = process.env.SIGNALING_NAMESPACE ?? '/signaling';
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  // Make JWT secret deterministic for the test session.
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret';

  const fakeTurn: FakeTurnService = (options.turn as FakeTurnService) ?? {
    calls: [] as TurnCredentialsOptions[],
    next: {
      urls: ['turn:turn.test.local:3478?transport=udp'],
      username: 'placeholder',
      credential: 'fake-cred',
      ttl: 3600,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    },
    generateCredentials(this: FakeTurnService, opts: TurnCredentialsOptions) {
      this.calls.push(opts);
      const expiresAt = new Date(Date.now() + this.next.ttl * 1000);
      return {
        ...this.next,
        username: `${opts.userId}:${Math.floor(expiresAt.getTime() / 1000)}`,
        credential: `cred-${opts.userId}-${opts.callId.slice(0, 8)}`,
        expiresAt: expiresAt.toISOString(),
      };
    },
  };

  const fakeSfu: FakeSfuService = (options.sfu as FakeSfuService) ?? {
    calls: [] as SfuTokenRequest[],
    next: {
      token: 'placeholder',
      url: 'wss://sfu.test.local/v1/rtc',
      roomId: 'sfu-room',
      callId: 'call-id',
      userId: 'user',
      expiresAt: new Date(Date.now() + 1800_000).toISOString(),
    },
    issueToken(this: FakeSfuService, req: SfuTokenRequest) {
      this.calls.push(req);
      const expiresAt = new Date(Date.now() + 1800_000);
      return {
        ...this.next,
        token: `sfu-token-${req.userId}-${req.callId.slice(0, 8)}`,
        roomId: `sfu-${req.callId}`,
        callId: req.callId,
        userId: req.userId,
        expiresAt: expiresAt.toISOString(),
      };
    },
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TURN_SERVICE)
    .useValue(fakeTurn)
    .overrideProvider(SFU_SERVICE)
    .useValue(fakeSfu)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  await app.init();
  await app.listen(0);

  const httpServer = app.getHttpServer() as unknown as Server;
  const addr = httpServer.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const callsService = app.get(CallsService);
  const eventsStore = app.get(CallEventsStore);

  // The peer server is started in main.ts but not when creating a Nest app, so
  // there is nothing to tear down. We only wait a tick to let socket.io bind.
  await wait(20);

  return {
    app,
    baseUrl,
    namespace,
    callsService,
    eventsStore,
    turnService: fakeTurn,
    sfuService: fakeSfu,
    close: async () => {
      await app.close();
    },
  };
}
