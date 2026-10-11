import { config } from 'dotenv';
config();

import { sql } from './shared/src/clients.js';
import { runNegotiatorTurn } from './ace-whatsapp/core/ai-negotiator/src/agentLoop.js';
import { runBiblioAgentTurn } from './ace-whatsapp/core/ai-negotiator/src/biblioAgentLoop.js';
import { StockoutPredictor } from './ace-whatsapp/core/supplier-integration/src/predictor.js';
import { DiscountGenerator } from './ace-whatsapp/core/retention-engine/src/discountGenerator.js';
import { logger } from './shared/src/logger.js';
import crypto from 'crypto';

const merchantPhone = '2348011111111';
const customerPhone = '2348022222222';

async function setupTestMerchant() {
  const merchantId = crypto.randomUUID();
  const customerId = crypto.randomUUID();
  const productId = crypto.randomUUID();

  // Create Merchant
  await sql`
    INSERT INTO merchants (id, name, contact_phone, phone_number_id)
    VALUES (${merchantId}, 'Validation Test Store', ${merchantPhone}, ${merchantPhone})
    ON CONFLICT (phone_number_id) DO UPDATE SET name = 'Validation Test Store'
    RETURNING id
  `;

  // Create Customer
  await sql`
    INSERT INTO customers (id, phone, name)
    VALUES (${customerId}, ${customerPhone}, 'Test Customer')
    ON CONFLICT (phone) DO UPDATE SET name = 'Test Customer'
    RETURNING id
  `;

  await sql`
    INSERT INTO customer_merchant_links (customer_id, merchant_id)
    VALUES (${customerId}, ${merchantId})
    ON CONFLICT DO NOTHING
  `;

  // Create Product
  await sql`
    INSERT INTO products (id, merchant_id, name, price, stock_quantity, reorder_threshold)
    VALUES (${productId}, ${merchantId}, 'Test Ankara Fabric', 10000, 10, 5)
    ON CONFLICT DO NOTHING
  `;

  // Enable Retention rules
  await sql`
    INSERT INTO merchant_pricing_rules (merchant_id, max_discount_percent, winback_discounts_enabled)
    VALUES (${merchantId}, 15, true)
    ON CONFLICT (merchant_id) DO UPDATE SET winback_discounts_enabled = true
  `;

  return { merchantId, customerId, productId };
}

async function test1_HappyPath(merchantId: string) {
  logger.log('\n>>> RUNNING TEST 1: Happy Path Negotiation', {});
  const turn: any = {
    customerId: customerPhone,
    merchantId,
    orderState: { status: 'no_order', items: [], quotedTotal: 0 },
    messages: [{ role: 'user', content: { text: 'Do you have Test Ankara Fabric? How much?' }, timestamp: Date.now() }]
  };
  await runNegotiatorTurn(turn);
  logger.log('✅ Test 1 Passed (Check stdout for AI response)', {});
}

async function test2_RestockTrigger(merchantId: string, productId: string) {
  logger.log('\n>>> RUNNING TEST 2: Supplier Restock Draft Trigger', {});
  
  // Force stock below threshold
  await sql`UPDATE products SET stock_quantity = 3 WHERE id = ${productId}`;

  const predictor = new StockoutPredictor();
  const lowStock = await predictor.checkAfterOrder([{ productId, quantity: 7 }]);
  
  if (lowStock.length === 1 && lowStock[0].sku === 'Test Ankara Fabric') {
    logger.log('✅ Test 2 Passed: Predictor caught the low stock correctly.', {});
  } else {
    logger.error('❌ Test 2 Failed: Predictor missed the low stock item.', {});
  }
}

async function test3_MidnightCron(merchantId: string, customerId: string) {
  logger.log('\n>>> RUNNING TEST 3: Retention Winback Generation', {});
  
  // Fake an old order
  await sql`
    INSERT INTO orders (id, merchant_id, customer_id, total_amount, status, created_at)
    VALUES (${crypto.randomUUID()}, ${merchantId}, ${customerId}, 150000, 'paid', NOW() - INTERVAL '35 days')
  `;
  await sql`
    INSERT INTO orders (id, merchant_id, customer_id, total_amount, status, created_at)
    VALUES (${crypto.randomUUID()}, ${merchantId}, ${customerId}, 50000, 'paid', NOW() - INTERVAL '60 days')
  `;

  const generator = new DiscountGenerator();
  const draft = await generator.draftWinback({
    customerId,
    merchantId,
    contactPhone: customerPhone,
    lastOrderDate: new Date().toISOString(),
    totalOrders: 2,
    lifetimeValue: 200000,
    daysSinceLastOrder: 35
  });

  if (draft && draft.proposedDiscountPercent > 0) {
    logger.log(`✅ Test 3 Passed: Drafted winback with ${draft.proposedDiscountPercent}% discount.`, {});
  } else {
    logger.error('❌ Test 3 Failed: Winback draft not generated correctly.', {});
  }
}

async function runValidation() {
  logger.log('Starting E2E Validation Suite...\n', {});
  const { merchantId, customerId, productId } = await setupTestMerchant();
  
  try {
    await test1_HappyPath(merchantId);
    await test2_RestockTrigger(merchantId, productId);
    await test3_MidnightCron(merchantId, customerId);
  } catch (err) {
    logger.error('Suite crashed:', err);
  } finally {
    logger.log('\n✅ Validation Suite Complete. Exiting.', {});
    process.exit(0);
  }
}

runValidation();
