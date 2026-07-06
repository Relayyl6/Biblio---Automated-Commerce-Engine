// vitest.config.ts
//
// Test runner config for the ACE Phase-1 backend. We test the PURE modules
// (pricingService, orderStateMachine, negotiationArc, paymentService,
// catalogMapper) — the side-effect-free core where the business rules live.
// Impure edges (Fastify handlers, Redis/Postgres adapters) are covered later
// with integration tests; these unit tests need no services running.
//
// The `@ace/shared/*` alias mirrors tsconfig.json so test imports resolve the
// same way the services do.

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@ace/shared": fileURLToPath(new URL("./shared/src", import.meta.url)),
    },
  },
  test: {
    // Only the colocated *.test.ts files under the backend tree. The apps have
    // their own toolchains and are excluded from the backend tsconfig too.
    include: ["ace-whatsapp/**/*.test.ts", "shared/**/*.test.ts"],
    environment: "node",
  },
});