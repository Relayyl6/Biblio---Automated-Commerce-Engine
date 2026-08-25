import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients";
import type { InboundMessage, NegotiationArc } from "@ace/shared/types";
import { enqueueInboundMessage } from "../ace-whatsapp/core/comms-router/src/debounce";
import { runNegotiatorTurn } from "../ace-whatsapp/core/ai-negotiator/src/agentLoop";

async function simulateSupplierSourcing() {
  const merchantId = "11111111-1111-1111-1111-111111111111"; // Use a mock UUID
  const customerId = "2348000000001";
  const edwinPhone = "2348000000002";
  const unityPhone = "2348000000003";
  const myPhone = "2348000000000";

  logger.log("🚀 Starting Supplier Sourcing Simulation...");

  // 1. Seed merchant
  await sql`
    INSERT INTO merchants (id, name, contact_phone, phone_number_id, tone_guide)
    VALUES (${merchantId}, 'Test Merchant', ${myPhone}, ${merchantId}, 'Friendly')
    ON CONFLICT (id) DO NOTHING
  `;

  // 2. Clear old data
  await sql`DELETE FROM source_quotes WHERE merchant_id = ${merchantId}`;
  await sql`DELETE FROM sources WHERE merchant_id = ${merchantId}`;

  // 3. Seed sources and pricing rules
  await sql`
    INSERT INTO sources (merchant_id, name, type, contact, description, pricing_rules)
    VALUES 
      (${merchantId}, 'Edwin', 'whatsapp_individual', ${edwinPhone}, 'iPhones, Samsung, all phones', '[
        {"if_cost_gte": 500000, "markup_type": "flat", "markup": 30000},
        {"if_cost_gte": 0, "markup_type": "flat", "markup": 22500}
      ]'),
      (${merchantId}, 'Unity', 'whatsapp_individual', ${unityPhone}, 'accessories, chargers, mice', '[
        {"if_cost_gte": 0, "markup_type": "percent", "markup": 20}
      ]')
  `;
  logger.log("✅ Seeded sources (Edwin and Unity) with pricing rules");

  // Clear arc and lock
  await redis.del(`arc:${merchantId}:${customerId}`);
  await redis.del(`lock:negotiation:${customerId}`);

  // 4. Simulate customer message
  const customerMsg: InboundMessage = {
    waMessageId: "msg_1",
    fromPhone: customerId,
    toPhoneNumberId: merchantId,
    timestamp: Date.now(),
    content: { type: "text", text: "How much is iPhone 11?" }
  };
  
  logger.log("\n📲 Customer sent: 'How much is iPhone 11?'");
  logger.log("⚙️ Running Agent Loop...");
  
  await runNegotiatorTurn({
    customerId,
    merchantId,
    orderState: { status: "no_order" },
    messages: [customerMsg]
  });

  // Verify arc is in awaiting_source
  const arcJson = await redis.get(`arc:${merchantId}:${customerId}`);
  const arc = JSON.parse(arcJson!) as any;
  logger.log("\n📊 Arc Stage after query:", arc.stage);
  if (arc.stage !== "awaiting_source") {
    logger.error("❌ Arc is not awaiting_source!");
  }

  // 5. Simulate supplier reply from Edwin
  const supplierMsg: InboundMessage = {
    waMessageId: "msg_2",
    fromPhone: edwinPhone,
    toPhoneNumberId: merchantId,
    timestamp: Date.now(),
    content: { type: "text", text: "iPhone 11 is 280k boss" }
  };

  logger.log(`\n📲 Supplier (Edwin) replied: '${supplierMsg.content.text}'`);
  logger.log("⚙️ Routing supplier reply...");
  await enqueueInboundMessage(supplierMsg);

  // 6. Check results
  const quotes = await sql`SELECT * FROM source_quotes WHERE merchant_id = ${merchantId}`;
  logger.log("\n📈 Final Source Quotes Row:");
  console.table(quotes);

  const updatedArcJson = await redis.get(`arc:${merchantId}:${customerId}`);
  const updatedArc = JSON.parse(updatedArcJson!) as any;
  logger.log("\n📊 Arc Stage after reply:", updatedArc.stage);
  logger.log("💬 Agent Last Offer (should be 302,500):", updatedArc.agentLastOffer);
  
  process.exit(0);
}

simulateSupplierSourcing().catch(err => {
  logger.error("Simulation failed:", err);
  process.exit(1);
});
