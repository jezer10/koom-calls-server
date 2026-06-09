import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import {
  buildPeerServerArgs,
  PeerProcess,
  registerShutdownHandlers,
  startPeerServer,
} from './peer-server';

class FakeStream extends EventEmitter {
  emitData(line: string) {
    this.emit('data', Buffer.from(line));
  }
}

class FakeProcess extends EventEmitter {
  stdout = new FakeStream();
  stderr = new FakeStream();
  kill = jest.fn();
  emitExit(code: number | null) {
    this.emit('exit', code);
  }
  writeStdout(line: string) {
    this.stdout.emitData(line);
  }
  writeStderr(line: string) {
    this.stderr.emitData(line);
  }
}

interface ChildProcessMock {
  spawn: jest.Mock;
  __instances: FakeProcess[];
}

jest.mock('node:child_process', () => {
  const instances: FakeProcess[] = [];
  return {
    spawn: jest.fn(() => {
      const proc = new FakeProcess();
      instances.push(proc);
      return proc as unknown as ReturnType<typeof spawn>;
    }),
    __instances: instances,
  };
});

const childProcess: ChildProcessMock = jest.requireMock('node:child_process');

describe('peer-server', () => {
  beforeEach(() => {
    childProcess.spawn.mockClear();
    childProcess.__instances.length = 0;
  });

  describe('buildPeerServerArgs()', () => {
    it('builds the canonical npx peerjs args', () => {
      expect(
        buildPeerServerArgs({ port: 9000, key: 'peerjs', path: '/' }),
      ).toEqual(['peerjs', '--port', '9000', '--path', '/', '--key', 'peerjs']);
    });

    it('appends --allow_discovery when requested', () => {
      expect(
        buildPeerServerArgs({
          port: 9000,
          key: 'peerjs',
          path: '/',
          allowDiscovery: true,
        }),
      ).toContain('--allow_discovery');
    });

    it('preserves caller-supplied prefixArgs', () => {
      expect(
        buildPeerServerArgs({
          port: 9000,
          key: 'peerjs',
          path: '/',
          prefixArgs: ['-y'],
        }),
      ).toEqual([
        '-y',
        'peerjs',
        '--port',
        '9000',
        '--path',
        '/',
        '--key',
        'peerjs',
      ]);
    });
  });

  describe('startPeerServer()', () => {
    it('spawns a process with the computed args', () => {
      startPeerServer({ port: 9000, key: 'peerjs', path: '/' });
      const calls = childProcess.spawn.mock.calls as Array<
        [string, string[], Record<string, unknown>]
      >;
      expect(calls).toContainEqual([
        'npx',
        ['peerjs', '--port', '9000', '--path', '/', '--key', 'peerjs'],
        expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
      ]);
    });

    it('forwards stdout/stderr/exit to provided loggers', () => {
      const logger = jest.fn();
      const errorLogger = jest.fn();
      const exitLogger = jest.fn();
      startPeerServer({
        port: 9000,
        key: 'peerjs',
        path: '/',
        logger,
        errorLogger,
        exitLogger,
      });
      const proc =
        childProcess.__instances[childProcess.__instances.length - 1];
      if (!proc) throw new Error('no fake process recorded');
      proc.writeStdout('hello\n');
      proc.writeStderr('oops\n');
      proc.emitExit(0);
      expect(logger).toHaveBeenCalledWith('hello');
      expect(errorLogger).toHaveBeenCalledWith('oops');
      expect(exitLogger).toHaveBeenCalledWith(0);
    });
  });

  describe('registerShutdownHandlers()', () => {
    it('installs SIGINT and SIGTERM handlers that kill the process and exit', () => {
      const proc = { kill: jest.fn() } as unknown as PeerProcess;
      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => undefined) as never);
      const onSpy = jest.spyOn(process, 'on');

      const off = registerShutdownHandlers(proc);

      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      const intHandler = onSpy.mock.calls.find(
        (c) => c[0] === 'SIGINT',
      )?.[1] as (() => void) | undefined;
      const termHandler = onSpy.mock.calls.find(
        (c) => c[0] === 'SIGTERM',
      )?.[1] as (() => void) | undefined;

      intHandler?.();
      termHandler?.();

      const procKill = (proc as unknown as { kill: jest.Mock }).kill;
      expect(procKill).toHaveBeenCalledWith('SIGINT');
      expect(procKill).toHaveBeenCalledWith('SIGTERM');
      expect(exitSpy).toHaveBeenCalledWith(0);

      off();
      onSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('returned disposer removes the listeners', () => {
      const proc = { kill: jest.fn() } as unknown as PeerProcess;
      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => undefined) as never);
      const onSpy = jest.spyOn(process, 'on');
      const offSpy = jest.spyOn(process, 'off');

      const off = registerShutdownHandlers(proc);
      off();

      expect(offSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      onSpy.mockRestore();
      offSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
