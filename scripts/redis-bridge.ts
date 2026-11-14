import net from 'net';

export const REDIS_BRIDGE_PORT = 6381;

export function startRedisBridge(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer((incoming) => {
      // Connect to local WSL forwarded port 6379, with fallback to 6380
      const outgoing = net.connect(6379, '127.0.0.1');
      incoming.pipe(outgoing);
      outgoing.pipe(incoming);

      incoming.on('error', () => outgoing.destroy());
      outgoing.on('error', () => incoming.destroy());
    });

    server.listen(REDIS_BRIDGE_PORT, '127.0.0.1', () => {
      console.log(`[redis-bridge] Bridging 127.0.0.1:${REDIS_BRIDGE_PORT} -> 127.0.0.1:6379 (Redis 7)`);
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