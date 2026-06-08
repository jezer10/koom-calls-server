import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/app.config';

interface InfoResponse {
  name: string;
  version: string;
  signaling: { namespace: string };
  peer: { enabled: boolean; port: number; path: string; key: string };
}

interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

describe('REST endpoints (e2e)', () => {
  let app: INestApplication;
  const config = loadConfig();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors({
      origin: config.signaling.corsOrigin,
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
    expect(typeof body.peer.enabled).toBe('boolean');
    expect(typeof body.peer.port).toBe('number');
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
