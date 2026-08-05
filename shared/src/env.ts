// shared/src/env.ts
//
// Every service in this repo imports its config from HERE, not from raw
// process.env scattered across files. Two reasons:
//
// 1) FAIL FAST. If WHATSAPP_APP_SECRET is missing, we want the process to
//    crash on boot with a clear message — not 40 minutes later when the
//    first webhook arrives and signature verification mysteriously fails.
// 2) ONE PLACE TO SEE WHAT EACH SERVICE NEEDS. New engineer onboarding:
//    "what env vars does ingestion-service need?" -> read this file.

import { z } from "zod";

const sharedSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
});

const ingestionSchema = sharedSchema.extend({
  PORT: z.coerce.number().default(3001),
  WHATSAPP_APP_SECRET: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
});

const negotiatorSchema = sharedSchema.extend({
  GROQ_API_KEY: z.string().min(1).default(() => process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || ""),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
});

const commsSchema = sharedSchema.extend({
  // Fallback token used only if a merchant has no dedicated WABA token stored
  // in the DB — e.g. during local dev or before a merchant finishes onboarding.
  WHATSAPP_ACCESS_TOKEN_FALLBACK: z.string().optional(),
  GRAPH_API_VERSION: z.string().default("v22.0"),
});

function loadEnv<T extends z.ZodTypeAny>(schema: T, serviceName: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    console.error(`[${serviceName}] invalid environment config:`);
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const loadIngestionEnv = () => loadEnv(ingestionSchema, "ingestion-service");
export const loadNegotiatorEnv = () => loadEnv(negotiatorSchema, "ai-negotiator");
export const loadCommsEnv = () => loadEnv(commsSchema, "comms-router");