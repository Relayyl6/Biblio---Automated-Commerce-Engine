import { logger } from "@ace/shared/logger.js";
import dns from "node:dns";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}
// Override DNS servers to use Google DNS — the WSL bridge (172.x.x.x) used by
// Windows as its default DNS resolver intermittently fails to resolve external
// hostnames like Neon DB pooler. Google DNS resolves them reliably.
if (typeof dns.setServers === "function") {
  try { dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch {}
}

import postgres from "postgres";
import { Redis } from "ioredis";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = postgres(connectionString, {
  // Neon's pooled connection string already handles pooling at the proxy
  // level, so keep this client-side pool small and disable prepared statements
  // for PgBouncer transaction mode compatibility.
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
  prepare: false, // Required for PgBouncer / Neon transaction pooler
});

/**
 * Wrap a typed value bound for a JSONB column. postgres.js types `sql.json`'s
 * parameter as `JSONValue`, which requires a string index signature that plain
 * domain interfaces (OrderState, NegotiationArc, …) deliberately don't carry.
 * Centralising the one unavoidable cast here keeps every insert site clean and
 * fully type-checked instead of sprinkling `as any` across services.
 */
export function jsonb(value: unknown): ReturnType<typeof sql.json> {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  connectTimeout: 10000,
  lazyConnect: false,
  retryStrategy(times) {
    // Capped exponential backoff: 500ms up to 5s
    return Math.min(times * 500, 5000);
  },
});

let lastRedisErrorLog = 0;
let lastRedisErrorMessage = "";

// Throttle errors to at most once every 60s per unique error to avoid terminal spam
redis.on("error", (err) => {
  const now = Date.now();
  if (err.message !== lastRedisErrorMessage || now - lastRedisErrorLog > 60000) {
    lastRedisErrorMessage = err.message;
    lastRedisErrorLog = now;
    logger.warn(`[redis] connection notice: ${err.message}. Retrying in background...`);
  }
});

redis.on("connect", () => {
  lastRedisErrorMessage = "";
  logger.info("[redis] connected successfully");
});
