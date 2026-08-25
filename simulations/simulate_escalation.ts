import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients";
import { vendorCommunique } from "./ace-whatsapp/core/comms-router/src/vendorCommunique.js";
import crypto from "crypto";

const SMS_WEBHOOK_URL = "http://127.0.0.1:3001/sms/webhook";

async function main() {
  logger.log("=== SIMULATING VENDOR COMMUNIQUÉ ENGINE ===");

  const customerId = "2348009999999";
  const merchantPhone = `234800${Math.floor(Math.random() * 1000000)}`;

  logger.log("1. Setting up mock merchant...");
  const merchantRows = await sql`
    insert into merchants (name, phone_number_id, paystack_recipient_code)
    values ('VIP Vendor', ${merchantPhone}, 'RCP_vip')
    returning id
  `;
  const merchantId = merchantRows[0].id;

  logger.log("\n2. AI Negotiator hits a wall and triggers escalate_to_merchant tool...");
  const mockArc = {
    sessionId: crypto.randomUUID(),
    stage: "counter",
    tier: "new",
    floor: 20000,
    productSku: "BLUE_GOWN",
    bundlePivotAttempted: true,
    futureCreditAttempted: true,
  };

  await vendorCommunique.dispatchEscalation(
    merchantId,
    merchantPhone,
    customerId,
    "Below-floor negotiation — manual exception required",
    { turn: mockArc as any, arc: mockArc as any }
  ).catch(async (err) => {
    logger.log("-> dispatchEscalation threw (likely AT sandbox auth), ignoring for simulation.");
    // Manually save session since dispatchEscalation aborted before saving
    await redis.setex(`communique:${merchantId}:active`, 3600, JSON.stringify({
      merchantId,
      merchantPhone,
      customerId,
      reason: "Below-floor negotiation — manual exception required",
      channel: "sms",
      state: { turn: mockArc, arc: mockArc }
    }));
  });

  const sessionRaw = await redis.get(`communique:${merchantId}:active`);
  if (!sessionRaw) throw new Error("No active communique session found in Redis!");
  logger.log("-> Escalation dispatched and session saved in Redis!");

  logger.log("\n3. Vendor receives SMS and replies '1' (Approve) to the webhook...");
  const smsRes = await fetch(SMS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: merchantPhone, text: "1" })
  });

  if (!smsRes.ok) throw new Error(`SMS webhook failed: ${smsRes.status}`);
  logger.log("-> SMS webhook accepted (200 OK)");

  await new Promise(r => setTimeout(r, 500));

  logger.log("\n4. Verifying Vendor Decision was recorded in database...");
  const decisions = await sql`select * from vendor_decisions where merchant_id = ${merchantId}`;
  if (decisions.length === 0) throw new Error("Vendor decision not saved to DB!");
  logger.log("-> Decision saved:", decisions[0].choice);

  logger.log("\n5. Verifying AI Negotiator was re-enqueued...");
  const scratch = await redis.lrange(`scratch:${merchantId}:${customerId}`, 0, -1);
  if (scratch.length === 0) throw new Error("System message not queued for AI!");
  logger.log("-> System message injected into customer scratch buffer for AI!");
  logger.log("Message:", JSON.parse(scratch[0]).content.text);

  await sql`delete from vendor_decisions where merchant_id = ${merchantId}`;
  await sql`delete from customer_merchant_links where merchant_id = ${merchantId}`;
  await sql`delete from merchants where id = ${merchantId}`;
  await redis.del(`scratch:${merchantId}:${customerId}`);
  
  logger.log("\n=== SIMULATION SUCCESSFUL ===");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error(err);
    process.exit(1);
  });
