import net from 'net';
import { spawn, execSync } from 'child_process';

export const REDIS_BRIDGE_PORT = 6381;

export function startRedisBridge(): Promise<number> {
  return new Promise((resolve) => {
    // Ensure redis-server is active inside WSL Ubuntu
    try {
      execSync('wsl.exe -d Ubuntu -u root -- service redis-server start', { stdio: 'ignore' });
    } catch (err: any) {
      console.warn('[redis-bridge] Note: WSL redis-server check:', err.message);
    }

    const server = net.createServer((incoming) => {
      incoming.setNoDelay(true);

      // Proxy connection to Redis 7 inside WSL via vsock stdio piping
      const proc = spawn('wsl.exe', ['-d', 'Ubuntu', '-u', 'root', '--', 'nc', '127.0.0.1', '6380'], {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      });

      incoming.pipe(proc.stdin);
      proc.stdout.pipe(incoming);

      incoming.on('error', () => {
        try { proc.kill(); } catch {}
      });
      incoming.on('close', () => {
        try { proc.kill(); } catch {}
      });

      proc.on('error', () => {
        try { incoming.destroy(); } catch {}
      });
      proc.on('close', () => {
        try { incoming.destroy(); } catch {}
      });
    });

    server.listen(REDIS_BRIDGE_PORT, '127.0.0.1', () => {
      console.log(`[redis-bridge] Bridging 127.0.0.1:${REDIS_BRIDGE_PORT} -> WSL Redis 7.0.15 (port 6380 via vsock)`);
      resolve(REDIS_BRIDGE_PORT);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[redis-bridge] Port ${REDIS_BRIDGE_PORT} already bound, bridge active.`);
        resolve(REDIS_BRIDGE_PORT);
      } else {
        console.error(`[redis-bridge] Error:`, err.message);
        resolve(REDIS_BRIDGE_PORT);
      }
    });
  });
}

if (process.argv[1]?.includes('redis-bridge')) {
  startRedisBridge();
}
