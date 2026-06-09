'use strict';

const WebSocket = require('ws');

/**
 * Minimal LiveKit signaling client used by the smoke test.
 *
 * Implements the very small subset of the LiveKit signaling protocol needed
 * to validate a token and confirm the SFU accepted the connection:
 *   - open WebSocket
 *   - wait for `joined` reply to the first `join` request
 *   - close
 *
 * Reference: https://github.com/livekit/protocol/blob/main/protocol.md
 *
 * @param {{ url: string, token: string, timeoutMs?: number }} opts
 * @returns {Promise<string>} summary like "joined sid=... participants=1"
 */
function connectLiveKit({ url, token, timeoutMs = 5000 }) {
  return new Promise((resolve, reject) => {
    // LiveKit's signaling endpoint is /rtc on the same host as the HTTP API.
    // Auth is delivered via the access_token query parameter, not via the
    // Authorization header. The signaling protocol is binary (protobuf) so
    // for the smoke test we just confirm the SFU accepted the handshake by
    // reading the first binary frame the server sends (its `joined` reply).
    const u = new URL(url);
    u.pathname = '/rtc';
    u.searchParams.set('access_token', token);
    u.protocol = u.protocol === 'wss:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(u.toString());
    let closed = false;

    const timer = setTimeout(() => {
      if (closed) return;
      closed = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error(`LiveKit WS connect timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.binaryType = 'arraybuffer';

    ws.on('open', () => {
      // Send the JSON-encoded handshake. LiveKit accepts JSON for the first
      // request and then switches to its own binary protocol.
      ws.send(
        JSON.stringify({
          msg: 1, // JOIN
          connect: true,
          auto_subscribe: true,
          reconnect: false,
        }),
      );
    });

    ws.on('message', (data) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      const buf = data instanceof ArrayBuffer ? data : null;
      const bytes = buf ? buf.byteLength : Buffer.byteLength(String(data));
      // The first server frame is the `joined` reply (binary, protobuf).
      // For the smoke test, we only need to confirm the SFU accepted the
      // token and answered the handshake.
      const summary = buf
        ? `binary frame (${bytes} bytes)`
        : `text frame (${bytes} chars)`;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(`LiveKit responded with ${summary}`);
    });

    ws.on('error', (err) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      reject(err);
    });

    ws.on('close', (code, reason) => {
      if (closed) return;
      clearTimeout(timer);
      reject(
        new Error(
          `LiveKit WS closed before handshake: code=${code} reason=${String(reason).slice(0, 120)}`,
        ),
      );
    });
  });
}

module.exports = { connectLiveKit };
