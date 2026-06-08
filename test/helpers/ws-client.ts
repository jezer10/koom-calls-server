import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

export interface WsClientOptions {
  url: string;
  namespace?: string;
  authToken?: string;
  transports?: ('websocket' | 'polling')[];
}

export interface ConnectedWsClient {
  socket: ClientSocket;
  close(): void;
}

export function connectWsClient(
  opts: WsClientOptions,
): Promise<ConnectedWsClient> {
  const namespace = opts.namespace ?? '';
  const base = `${opts.url}${namespace}`;
  const socket = ioClient(base, {
    transports: opts.transports ?? ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: opts.authToken ? { token: opts.authToken } : undefined,
  });
  return new Promise((resolve, reject) => {
    const onConnect = () => {
      socket.off('connect_error', onError);
      resolve({
        socket,
        close: () => {
          if (socket.connected) socket.disconnect();
        },
      });
    };
    const onError = (err: Error) => {
      socket.off('connect', onConnect);
      reject(err);
    };
    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
  });
}

export function waitFor<T>(
  fn: () => T | undefined | Promise<T | undefined>,
  timeoutMs = 3000,
  intervalMs = 10,
  label = 'condition',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        const value = await fn();
        if (value !== undefined && value !== false && value !== null) {
          resolve(value);
          return;
        }
      } catch {
        // ignore
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`waitFor: timed out waiting for ${label}`));
        return;
      }
      setTimeout(() => {
        void tick();
      }, intervalMs);
    };
    void tick();
  });
}

export const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export type { ClientSocket };
