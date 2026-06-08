import { spawn, ChildProcessByStdio } from 'node:child_process';
import { Readable } from 'node:stream';

export type PeerProcess = ChildProcessByStdio<null, Readable, Readable>;

export interface PeerServerOptions {
  port: number;
  key: string;
  path: string;
  allowDiscovery?: boolean;
  command?: string;
  prefixArgs?: string[];
  logger?: (line: string) => void;
  errorLogger?: (line: string) => void;
  exitLogger?: (code: number | null) => void;
}

export function buildPeerServerArgs(opts: PeerServerOptions): string[] {
  const args: string[] = [...(opts.prefixArgs ?? []), 'peerjs'];
  args.push('--port', String(opts.port));
  args.push('--path', opts.path);
  args.push('--key', opts.key);
  if (opts.allowDiscovery) args.push('--allow_discovery');
  return args;
}

export function startPeerServer(opts: PeerServerOptions): PeerProcess {
  const command = opts.command ?? 'npx';
  const args = buildPeerServerArgs(opts);
  const proc = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  if (opts.logger) {
    proc.stdout.on('data', (b: Buffer) =>
      opts.logger?.(b.toString().trimEnd()),
    );
  }
  if (opts.errorLogger) {
    proc.stderr.on('data', (b: Buffer) =>
      opts.errorLogger?.(b.toString().trimEnd()),
    );
  }
  if (opts.exitLogger) {
    proc.on('exit', (code) => opts.exitLogger?.(code));
  }

  return proc;
}

export function registerShutdownHandlers(proc: PeerProcess): () => void {
  const onSigint = () => {
    proc.kill('SIGINT');
    process.exit(0);
  };
  const onSigterm = () => {
    proc.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);
  return () => {
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
  };
}
