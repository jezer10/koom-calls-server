import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface InfoResponse {
  name: string;
  version: string;
  signaling: { namespace: string };
  media: { provider: string };
}

interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

describe('REST endpoints (e2e)', () => {
  let app: INestApplication;
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns the server banner', () => {
    return request(app.getHttpServer() as App)
      .get('/')
      .expect(200)
      .expect('Koom Calls signaling server');
  });

  it('GET /info exposes server metadata', async () => {
    const res = await request(app.getHttpServer() as App)
      .get('/info')
      .expect(200);
    const body = res.body as InfoResponse;
    expect(body.name).toBe('koom-calls-server');
    expect(typeof body.version).toBe('string');
    expect(body.signaling.namespace).toBe('/signaling');
    expect(body.media.provider).toBe('livekit');
  });

  it('GET /health reports status ok', async () => {
    const res = await request(app.getHttpServer() as App)
      .get('/health')
      .expect(200);
    const body = res.body as HealthResponse;
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });
});
