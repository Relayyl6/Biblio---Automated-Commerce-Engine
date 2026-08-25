import { logger } from "@ace/shared/logger.js";
// core/comms-router/src/smsWebhook.ts
import Fastify from "fastify";
import fastifyRawBody from "fastify-raw-body";
import { vendorCommunique } from "./vendorCommunique.js";
import { sql } from "@ace/shared/clients";

import crypto from "crypto";

const app = Fastify({ logger: true });

app.register(fastifyRawBody, {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true
});

app.post("/sms/webhook", { config: { rawBody: true } }, async (request, reply) => {
  try {
    // ── PRODUCTION SIGNATURE VERIFICATION ──────────────────────────
    // Africa's Talking passes an HMAC-SHA256 signature in the headers
    const signature = request.headers["africastalking-signature"] as string;
    const apiKey = process.env.AT_API_KEY;

    if (process.env.NODE_ENV === "production") {
      if (!signature) {
        request.log.warn("[SMS Webhook] Missing africastalking-signature header");
        return reply.code(401).send({ error: "Unauthorized" });
      }

      if (!apiKey) {
        request.log.error("[SMS Webhook] CRITICAL: AT_API_KEY is not set in production");
        return reply.code(500).send({ error: "Server Configuration Error" });
      }

      const generatedSignature = crypto
        .createHmac("sha256", apiKey)
        .update(request.rawBody || "")
        .digest("hex");

      // Use timingSafeEqual to prevent timing attacks
      const isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(generatedSignature)
      );

      if (!isSignatureValid) {
        request.log.warn("[SMS Webhook] Invalid signature detected");
        return reply.code(403).send({ error: "Forbidden: Invalid Signature" });
      }
    }

    // ── PAYLOAD PARSING ─────────────────────────────────────────────
    // Africa's Talking sends data as application/x-www-form-urlencoded
    const params = new URLSearchParams(request.rawBody as string);
    const fromPhone = params.get("from")?.replace(/^\+/, "");
    const text = params.get("text")?.trim();

    if (!fromPhone || !text) {
      return reply.code(400).send({ error: "Invalid payload" });
    }

    // Lookup merchant by phone
    const vendorRows = await sql<{ merchant_id: string }[]>`
      SELECT merchant_id FROM vendors
      WHERE personal_number = ${fromPhone} OR business_line_number = ${fromPhone}
      LIMIT 1
    `;
    
    const merchantId = vendorRows[0]?.merchant_id;
    if (!merchantId) {
      request.log.warn(`[SMS Webhook] Unregistered phone number: ${fromPhone}`);
      return reply.send({ success: false, reason: "Unregistered phone number" });
    }

    const handled = await vendorCommunique.handleMerchantReply(merchantId, text);
    
    if (handled) {
      // Idempotent success response to Africa's Talking
      // You can also trigger an outbound SMS back to the merchant confirming receipt
      await vendorCommunique.sendSms(merchantId, fromPhone, "Decision recorded. Continuing negotiation.");
    }

    return reply.send({ success: true, handled });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: "Internal Server Error" });
  }
});

const port = Number(process.env.PORT || 3005);
app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    logger.error(err.message, { err });
    process.exit(1);
  }
  logger.log(`[smsWebhook] Server listening at ${address}`);
});
