import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";
import { runNegotiatorTurn } from "../ace-whatsapp/core/ai-negotiator/src/agentLoop";
import type { InboundMessage } from "@ace/shared/types";
import { generateEmbedding } from "@ace/shared/data-intelligence/embeddings";
import { redis } from "@ace/shared/clients";

async function simulateVisualSearch() {
  const merchantId = "11111111-1111-1111-1111-111111111111"; // Use a mock UUID
  const customerId = "2348000000005";
  const myPhone = "2348000000000";

  logger.log("🚀 Starting Visual Search Simulation...");

  // 1. Seed merchant
  await sql`
    INSERT INTO merchants (id, name, contact_phone, phone_number_id, tone_guide)
    VALUES (${merchantId}, 'Test Merchant', ${myPhone}, ${merchantId}, 'Friendly')
    ON CONFLICT (id) DO NOTHING
  `;

  // 2. Clear old data for this test
  await sql`DELETE FROM products WHERE merchant_id = ${merchantId} AND sku LIKE 'VIS-%'`;

  logger.log("Generating dummy embeddings for visual products... (this will download Xenova/clip if it is the first time)");
  
  // Seed two items with visually distinct descriptions
  const redShoesDesc = "Red running shoes for men";
  const redShoesVector = await generateEmbedding(redShoesDesc);
  
  const blueDressDesc = "Blue evening lace dress for women";
  const blueDressVector = await generateEmbedding(blueDressDesc);

  await sql`
    INSERT INTO products (
      sku, merchant_id, name, price, description,
      image_url, stock, currency, active, source,
      image_embedding, last_posted_at, updated_at
    ) VALUES 
    (
      'VIS-RED-SHOES', ${merchantId}, 'Red Shoes', 25000, ${redShoesDesc},
      NULL, 5, 'NGN', true, 'vendor_push', ${`[${redShoesVector.join(",")}]`}, NULL, now()
    ),
    (
      'VIS-BLU-DRESS', ${merchantId}, 'Blue Dress', 45000, ${blueDressDesc},
      NULL, 5, 'NGN', true, 'vendor_push', ${`[${blueDressVector.join(",")}]`}, NULL, now()
    )
  `;

  logger.log("✅ Seeded products with 512-dim CLIP embeddings");

  // Clear arc
  await redis.del(`arc:${merchantId}:${customerId}`);
  await redis.del(`lock:negotiation:${customerId}`);

  // 4. Simulate customer message
  const customerMsg: InboundMessage = {
    waMessageId: "msg_vis_1",
    fromPhone: customerId,
    toPhoneNumberId: merchantId,
    timestamp: Date.now(),
    content: { type: "text", text: "how much is that blue lace dress?" } // "blue lace dress" is semantically close to VIS-BLU-DRESS
  };

  logger.log(`\n📲 Customer sent: '${customerMsg.content.text}'`);
  logger.log("⚙️ Running Agent Loop...");
  
  await runNegotiatorTurn({
    customerId,
    merchantId,
    orderState: { status: "no_order" },
    messages: [customerMsg]
  });

  logger.log("\n✅ Simulation Complete");
  process.exit(0);
}

simulateVisualSearch().catch(err => {
  logger.error("Simulation failed:", err);
  process.exit(1);
});
