import net from 'net';
import { execSync } from 'child_process';

export const REDIS_BRIDGE_PORT = 6381;

export function startRedisBridge(): Promise<number> {
  return new Promise((resolve) => {
    const wslIp = process.env.WSL_IP || '172.27.83.102';

    const server = net.createServer((incoming) => {
      const outgoing = net.connect(6380, wslIp);
      incoming.pipe(outgoing);
      outgoing.pipe(incoming);

      incoming.on('error', () => outgoing.destroy());
      outgoing.on('error', () => incoming.destroy());
    });

    server.listen(REDIS_BRIDGE_PORT, '127.0.0.1', () => {
      console.log(`[redis-bridge] Bridging 127.0.0.1:${REDIS_BRIDGE_PORT} -> WSL ${wslIp}:6380 (Redis 7)`);
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

// When run directly as a script
if (process.argv[1]?.includes('redis-bridge')) {
  startRedisBridge();
}
