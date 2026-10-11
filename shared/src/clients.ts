import { logger } from "@ace/shared/logger.js";
// shared/src/clients.ts
//
// Two infrastructure decisions worth explaining:
//
// 1) We use `postgres` (the "postgres.js" library) over the older `pg`
//    driver. It's written in TS, has a much nicer tagged-template query
//    API (sql`select * from orders where id = ${id}` — parameterized
//    automatically, no manual `$1` placeholders), and has a smaller,
//    faster connection setup that plays well with serverless/edge
//    environments — relevant since you're on Neon, which is built for
//    exactly this connection pattern (PgBouncer-style pooling).
//
// 2) Redis here is doing THREE distinct jobs, and it's worth naming them
//    so you don't accidentally conflate them later:
//      - Debounce keys (comms-router): short-lived, ~45s TTL
//      - Idempotency keys (ingestion-service): dedup WhatsApp message IDs,
//        ~24h TTL
//      - Distributed locks (state-machine): prevent two concurrent
//        webhook deliveries from double-processing the same order
//
//    All three live in the same Redis instance for an MVP, but they have
//    very different TTL/eviction needs — keep their key prefixes distinct
//    (`debounce:`, `idempotency:`, `lock:`) so you can split them onto
//    separate Redis instances later without touching call sites.

import postgres from "postgres";
import { Redis } from "ioredis";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = postgres(connectionString, {
  // Neon's pooled connection string already handles pooling at the proxy
  // level, so keep this client-side pool small.
  max: 10,
  idle_timeout: 30,
  connect_timeout: 30, // Survive Neon cold-start (~5-15s wake-up delay)
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

import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 2,
  connectTimeout: 5000,
  lazyConnect: false,
  retryStrategy(times) {
    // Capped exponential backoff: 1s up to 10s
    return Math.min(times * 1000, 10000);
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