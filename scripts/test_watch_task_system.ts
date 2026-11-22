import { sql, redis } from '../shared/src/clients.js';
import { startRedisBridge } from './redis-bridge.js';
import { WatchTaskService } from '../ace-whatsapp/core/ai-negotiator/src/services/watchTaskService.js';
import { handleWatchTaskTool } from '../ace-whatsapp/core/ai-negotiator/src/tools/watchTaskTools.js';

async function runTests() {
  await startRedisBridge();
  console.log('🧪 Starting Watch Task System End-to-End Tests...\n');

  // Find or create test merchant
  const merchants = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM merchants LIMIT 1
  `;
  if (!merchants[0]) {
    throw new Error('No merchant found in database for test.');
  }
  const merchantId = merchants[0].id;
  const testCustomerPhone = '+2348011223344';
  const testSku = 'TEST-BLUE-JKT-' + Date.now();

  console.log(`Using merchant ${merchants[0].name} (${merchantId}) and customer ${testCustomerPhone}`);

  // Clean any previous test watch tasks
  await sql`
    DELETE FROM customer_watch_tasks WHERE customer_id = ${testCustomerPhone}
  `;

  // ── TEST 1: create_watch_task ─────────────────────────────────────────────
  console.log('\n--- 1. Testing create_watch_task ---');
  const createRes1 = await handleWatchTaskTool('create_watch_task', {
    criteria: {
      item: 'denim jacket',
      color: 'blue',
      size: 'XL',
      max_price: 35000,
    },
    expiry: '14d',
    notify_channel: 'whatsapp',
  }, { merchantId, customerId: testCustomerPhone });

  console.log('Create result:', {
    taskId: createRes1.task.id,
    duplicate: createRes1.duplicate,
    message: createRes1.message,
    status: createRes1.task.status,
  });

  if (!createRes1.task.id || createRes1.duplicate !== false) {
    throw new Error('Test 1 Failed: Task creation failed.');
  }
  const taskId = createRes1.task.id;

  // ── TEST 2: Duplicate check ───────────────────────────────────────────────
  console.log('\n--- 2. Testing duplicate task prevention ---');
  const createRes2 = await handleWatchTaskTool('create_watch_task', {
    criteria: {
      item: 'denim jacket',
      color: 'blue',
      size: 'XL',
    },
  }, { merchantId, customerId: testCustomerPhone });

  console.log('Duplicate test result:', {
    taskId: createRes2.task.id,
    duplicate: createRes2.duplicate,
    message: createRes2.message,
  });

  if (createRes2.duplicate !== true || createRes2.task.id !== taskId) {
    throw new Error('Test 2 Failed: Duplicate watch task was not prevented.');
  }

  // ── TEST 3: list_watch_tasks ──────────────────────────────────────────────
  console.log('\n--- 3. Testing list_watch_tasks ---');
  const listRes = await handleWatchTaskTool('list_watch_tasks', {
    status: 'active',
  }, { merchantId, customerId: testCustomerPhone });

  console.log(`Listed ${listRes.count} active tasks:`, listRes.tasks);
  if (listRes.count !== 1 || listRes.tasks[0].id !== taskId) {
    throw new Error('Test 3 Failed: List tasks did not return active task.');
  }

  // ── TEST 4: update_watch_task ─────────────────────────────────────────────
  console.log('\n--- 4. Testing update_watch_task ---');
  const updateRes = await handleWatchTaskTool('update_watch_task', {
    task_id: taskId,
    new_criteria: {
      color: 'deep navy blue',
      max_price: 40000,
    },
    new_expiry: '30d',
  }, { merchantId, customerId: testCustomerPhone });

  console.log('Update result:', {
    success: updateRes.success,
    updatedCriteria: updateRes.task.criteria,
    newExpiry: updateRes.task.expiry,
  });

  if (!updateRes.success || updateRes.task.criteria.color !== 'deep navy blue') {
    throw new Error('Test 4 Failed: Watch task update failed.');
  }

  // ── TEST 5: match_inventory (no stock yet) ────────────────────────────────
  console.log('\n--- 5. Testing match_inventory before stock arrives ---');
  const matchResBefore = await handleWatchTaskTool('match_inventory', {
    criteria: {
      item: 'denim jacket',
      color: 'navy',
    },
  }, { merchantId, customerId: testCustomerPhone });

  console.log('Matches before stocking:', {
    exactCount: matchResBefore.exactMatches.length,
    alternativeCount: matchResBefore.closeAlternatives.length,
  });

  // ── TEST 6: Restock event & auto-notification ─────────────────────────────
  console.log('\n--- 6. Testing Restock & Instant Event Hook ---');
  // Insert newly restocked product in store
  await sql`
    INSERT INTO products (
      merchant_id, sku, name, price, stock, description, category, colors, sizes, active
    ) VALUES (
      ${merchantId}::uuid,
      ${testSku},
      'Vintage Denim Jacket',
      32000,
      5,
      ${JSON.stringify({ text: 'High quality deep navy blue vintage denim jacket' })}::jsonb,
      'Outerwear',
      ${JSON.stringify(['deep navy blue'])}::jsonb,
      ${['XL']},
      true
    )
  `;

  // Trigger onInventoryChanged hook
  const hookResult = await WatchTaskService.onInventoryChanged(merchantId, {
    sku: testSku,
    action: 'restocked',
  });

  console.log('Inventory event hook result:', hookResult);

  // Check task state in database
  const taskAfterRestock = await sql`
    SELECT * FROM customer_watch_tasks WHERE id = ${taskId}::uuid
  `;
  console.log('Task state after restock:', {
    status: taskAfterRestock[0]?.status,
    notification_sent: taskAfterRestock[0]?.notification_sent,
    matched_items: taskAfterRestock[0]?.matched_items,
  });

  if (taskAfterRestock[0]?.status !== 'fulfilled' || taskAfterRestock[0]?.notification_sent !== true) {
    throw new Error('Test 6 Failed: Watch task was not marked fulfilled upon verified inventory restock.');
  }

  // ── TEST 7: cancel_watch_task ─────────────────────────────────────────────
  console.log('\n--- 7. Testing cancel_watch_task ---');
  // Create another task to test cancellation
  const createForCancel = await WatchTaskService.createWatchTask({
    customerId: testCustomerPhone,
    merchantId,
    criteria: { item: 'leather boots', size: '43' },
  });
  const cancelRes = await handleWatchTaskTool('cancel_watch_task', {
    task_id: createForCancel.task.id,
  }, { merchantId, customerId: testCustomerPhone });

  console.log('Cancel result:', cancelRes);
  if (!cancelRes.success) {
    throw new Error('Test 7 Failed: Task cancellation failed.');
  }

  // Cleanup test product
  await sql`DELETE FROM products WHERE sku = ${testSku}`;
  await sql`DELETE FROM customer_watch_tasks WHERE customer_id = ${testCustomerPhone}`;

  console.log('\n✅ ALL 7 WATCH TASK SYSTEM TESTS PASSED CLEANLY!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
