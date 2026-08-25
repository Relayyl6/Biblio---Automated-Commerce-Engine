const fs = require('fs');

// 1. Rewrite postPaymentFlow.ts
let postPayment = fs.readFileSync('ace-whatsapp/core/event-orchestrator/src/flows/postPaymentFlow.ts', 'utf8');
postPayment = postPayment.replace(
  /const sub = redis\.duplicate\(\);[\s\S]*?logger\.log\("\[PostPaymentFlow\] Listening for payment_confirmed events\.\.\."\);/,
  `const { Worker, Queue } = require("bullmq");\n
  const worker = new Worker("domain-events", async (job) => {
    if (job.name === "payment_confirmed") {
      const payload = job.data;
      await handlePaymentConfirmed(payload.orderId, payload.merchantId, payload.customerId);
    }
  }, { connection: { ...redis.options, maxRetriesPerRequest: null } });

  worker.on("failed", (job, err) => logger.error(\`[PostPaymentFlow] Job \${job?.id} failed:\`, err));
  worker.on("error", (err) => logger.error(\`[PostPaymentFlow] Redis error:\`, err));

  logger.log("[PostPaymentFlow] Listening for domain-events (payment_confirmed)...");
  return worker;`
);
fs.writeFileSync('ace-whatsapp/core/event-orchestrator/src/flows/postPaymentFlow.ts', postPayment, 'utf8');

// 2. Rewrite inventoryRestockFlow.ts
let invRestock = fs.readFileSync('ace-whatsapp/core/event-orchestrator/src/flows/inventoryRestockFlow.ts', 'utf8');
invRestock = invRestock.replace(
  /const sub = redis\.duplicate\(\);[\s\S]*?logger\.log\("\[InventoryRestockFlow\] Listening for inventory_deducted events\.\.\."\);/,
  `const { Worker, Queue } = require("bullmq");\n
  const worker = new Worker("domain-events", async (job) => {
    if (job.name === "inventory_deducted") {
      const payload = job.data;
      const dedupe = \`idempotency:restock:\${payload.merchantId}:\${payload.sku}\`;
      const isNew = await redis.set(dedupe, "1", "EX", 3600, "NX");
      if (!isNew) return;
      await handleInventoryCheck(payload.merchantId, payload.sku);
    }
  }, { connection: { ...redis.options, maxRetriesPerRequest: null } });

  worker.on("failed", (job, err) => logger.error(\`[InventoryRestockFlow] Job \${job?.id} failed:\`, err));
  worker.on("error", (err) => logger.error(\`[InventoryRestockFlow] Redis error:\`, err));

  logger.log("[InventoryRestockFlow] Listening for domain-events (inventory_deducted)...");
  return worker;`
);
fs.writeFileSync('ace-whatsapp/core/event-orchestrator/src/flows/inventoryRestockFlow.ts', invRestock, 'utf8');

// 3. Rewrite loyaltyMilestoneFlow.ts
let loyalty = fs.readFileSync('ace-whatsapp/core/event-orchestrator/src/flows/loyaltyMilestoneFlow.ts', 'utf8');
if (loyalty.includes('redis.subscribe')) {
  loyalty = loyalty.replace(
    /const sub = redis\.duplicate\(\);[\s\S]*?logger\.log\("\[LoyaltyMilestoneFlow\] Listening for order_completed events\.\.\."\);/,
    `const { Worker, Queue } = require("bullmq");\n
    const worker = new Worker("domain-events", async (job) => {
      if (job.name === "order_completed") {
        const payload = job.data;
        await handleOrderCompleted(payload.orderId, payload.merchantId, payload.customerId);
      }
    }, { connection: { ...redis.options, maxRetriesPerRequest: null } });

    worker.on("failed", (job, err) => logger.error(\`[LoyaltyMilestoneFlow] Job \${job?.id} failed:\`, err));
    worker.on("error", (err) => logger.error(\`[LoyaltyMilestoneFlow] Redis error:\`, err));

    logger.log("[LoyaltyMilestoneFlow] Listening for domain-events (order_completed)...");
    return worker;`
  );
  fs.writeFileSync('ace-whatsapp/core/event-orchestrator/src/flows/loyaltyMilestoneFlow.ts', loyalty, 'utf8');
}
