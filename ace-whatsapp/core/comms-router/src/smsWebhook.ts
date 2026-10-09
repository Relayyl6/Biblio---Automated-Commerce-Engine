import { logger } from "@ace/shared/logger.js";
import Fastify from "fastify";
import fastifyRawBody from "fastify-raw-body";
import { vendorCommunique } from "./vendorCommunique.js";
import { sql } from "@ace/shared/clients.js";
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

      const isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(generatedSignature)
      );

      if (!isSignatureValid) {
        request.log.warn("[SMS Webhook] Invalid signature detected");
        return reply.code(403).send({ error: "Forbidden: Invalid Signature" });
      }
    }

    const params = new URLSearchParams(request.rawBody as string);
    const fromPhone = params.get("from")?.replace(/^\+/, "");
    const text = params.get("text")?.trim();

    if (!fromPhone || !text) {
      return reply.code(400).send({ error: "Invalid payload" });
    }

    // 1. Check if the sender is a Vendor
    const vendorRows = await sql<{ merchant_id: string }[]>`
      SELECT merchant_id FROM vendors
      WHERE personal_number = ${fromPhone} OR business_line_number = ${fromPhone}
      LIMIT 1
    `;
    
    const merchantId = vendorRows[0]?.merchant_id;
    if (merchantId) {
      // It's a Vendor Reply
      const handled = await vendorCommunique.handleMerchantReply(merchantId, text);
      if (handled) {
        await vendorCommunique.sendSms(merchantId, fromPhone, "Decision recorded. Continuing negotiation.");
      }
      return reply.send({ success: true, handled });
    }

    // 2. Check if the sender is a Customer (Phase 2 Offline Escalation)
    const customerRows = await sql<{ id: string, merchant_id: string }[]>`
      SELECT id, merchant_id FROM customers 
      WHERE phone = ${fromPhone}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const customerMatch = customerRows[0];
    if (customerMatch) {
      request.log.info(`[SMS Webhook] Customer ${fromPhone} replied via SMS. Routing to Inbox...`);
      
      // Inject into the standard Omni-Channel Debouncer so the AI Negotiator processes it natively!
      const { enqueueInboundMessage } = await import("./debounce.js");
      await enqueueInboundMessage({
        id: crypto.randomUUID(),
        merchantId: customerMatch.merchant_id,
        customerId: customerMatch.id,
        platform: "sms",
        type: "text",
        text: text,
        timestamp: Date.now()
      });

      return reply.send({ success: true, routedToCustomerInbox: true });
    }

    request.log.warn(`[SMS Webhook] Unregistered phone number (neither vendor nor customer): ${fromPhone}`);
    return reply.send({ success: false, reason: "Unregistered phone number" });
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

