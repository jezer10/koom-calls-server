import { JoinRequest, ClientInfo } from './node_modules/.pnpm/@livekit+protocol@1.46.6/node_modules/@livekit/protocol/dist/index.cjs';
import crypto from 'node:crypto';

const apiKey = 'devkey';
const apiSecret = 'secret';
const room = 'sfu-test-123';
const identity = 'user-test-1';
const now = Math.floor(Date.now() / 1000);

const jr = new JoinRequest({
  clientInfo: new ClientInfo({
    sdk: 1,
    protocol: 1,
    version: '1.0.0',
  }),
});
const jrBase64 = Buffer.from(jr.toBinary()).toString('base64');

const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  iss: apiKey,
  sub: identity,
  iat: now,
  exp: now + 3600,
  video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const h = b64u(header);
const p = b64u(payload);
const sig = crypto.createHmac('sha256', apiSecret).update(`${h}.${p}`).digest('base64url');
const jwt = `${h}.${p}.${sig}`;

console.log(`JWT=${jwt}`);
console.log(`JOIN_REQ=${jrBase64}`);
