const fs = require('fs');

function patchPayment() {
  const file = 'ace-whatsapp/core/payment-verification/src/index.ts';
  let content = fs.readFileSync(file, 'utf8');

  // Fix 1.1: Escrow Lock
  const escrowOld = `    if (recipientCode && dealPrice > 0) {
      // 3. Initiate Transfer
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;`;
  const escrowNew = `    if (recipientCode && dealPrice > 0) {
      // 3. Initiate Transfer (Atomic Lock)
      const escrowUpdateRows = await sql\`
        UPDATE escrow_accounts SET status = 'releasing', updated_at = now()
        WHERE order_id = \${orderId} AND status = 'held'
        RETURNING id
      \`;
      if (escrowUpdateRows.length === 0) {
        app.log.warn({ orderId }, "Escrow already released or not held, aborting transfer");
        return reply.send({ ok: true, ignored: true });
      }

      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;`;
  content = content.replace(escrowOld, escrowNew);

  // Fix 1.2: Redis Trap
  const trapOld = `  const dedupeKey = \`idempotency:payment:\${payment.providerRef}\`;
  const isNew = await redis.set(dedupeKey, "1", "EX", 60 * 60 * 24, "NX");
  if (!isNew) {
    app.log.info({ providerRef: payment.providerRef }, "duplicate payment, skipping");
    return;
  }`;
  const trapNew = `  // Fast idempotency gate removed to prevent ghost drops on crash. 
  // We now rely solely on the DB's unique constraint on provider_ref.`;
  content = content.replace(trapOld, trapNew);

  // Fix 1.3: Stateless Underpayments
  const underOld = `async function handleUnderpayment(order: MatchedOrder, payment: NormalizedPayment): Promise<void> {
  const balance = order.total - payment.amountNgn;
  await sql\`
    insert into transactions
      (order_id, merchant_id, customer_id, amount, virtual_account, provider_ref, status)
    values (
      \${order.orderId}, \${order.merchantId}, \${order.customerId},
      \${payment.amountNgn}, \${payment.virtualAccount}, \${payment.providerRef}, 'underpaid'
    )
    on conflict (provider_ref) do nothing
  \`;`;
  const underNew = `async function handleUnderpayment(order: MatchedOrder, payment: NormalizedPayment): Promise<void> {
  await sql\`
    insert into transactions
      (order_id, merchant_id, customer_id, amount, virtual_account, provider_ref, status)
    values (
      \${order.orderId}, \${order.merchantId}, \${order.customerId},
      \${payment.amountNgn}, \${payment.virtualAccount}, \${payment.providerRef}, 'underpaid'
    )
    on conflict (provider_ref) do nothing
  \`;

  const rows = await sql\`
    SELECT SUM(amount) as sum FROM transactions WHERE order_id = \${order.orderId} AND status != 'failed'
  \`;
  const totalPaid = parseInt(rows[0]?.sum ?? "0", 10);
  const balance = order.total - totalPaid;`;
  content = content.replace(underOld, underNew);

  fs.writeFileSync(file, content);
  console.log('Patched payment-verification');
}

function patchAgent() {
  const file = 'ace-whatsapp/core/ai-negotiator/src/agentLoop.ts';
  let content = fs.readFileSync(file, 'utf8');

  const oldLock = `  const lockKey = \`lock:negotiation:\${turn.customerId}\`;
  const lockAcquired = await redis.set(lockKey, "1", "EX", LOCK_TTL_SECONDS, "NX");
  
  if (!lockAcquired) {
    logger.warn(\`[negotiator] lock contention for customer \${turn.customerId} - dropping duplicate turn\`);
    return;
  }`;
  const newLock = `  const lockKey = \`lock:negotiation:\${turn.customerId}\`;
  let lockAcquired = false;
  let attempts = 0;
  
  while (!lockAcquired && attempts < 10) {
    lockAcquired = (await redis.set(lockKey, "1", "EX", LOCK_TTL_SECONDS, "NX")) !== null;
    if (!lockAcquired) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  if (!lockAcquired) {
    logger.warn(\`[negotiator] lock contention for customer \${turn.customerId} - escalating instead of dropping\`);
    await safeEscalate(turn, "Agent busy with previous request.");
    return;
  }`;
  content = content.replace(oldLock, newLock);
  fs.writeFileSync(file, content);
  console.log('Patched agentLoop');
}

function patchStateMachine() {
  const file = 'ace-whatsapp/core/state-machine/src/orderStateMachine.ts';
  let content = fs.readFileSync(file, 'utf8');

  const oldCode = `    if (!("code" in result)) {
      // It's a successful transition
      try {
        await sql\`UPDATE orders SET state = \${sql.json(result as any)}, updated_at = NOW() WHERE id = \${orderId}\`;
      } catch (err) {
        throw new Error(\`Failed to update order state in DB: \${err}\`);
      }
  
      // Emit event
      try {
        if (event.type === "PAYMENT_CONFIRMED") {
        await domainEventsQueue.add("payment_confirmed", { merchantId, customerId, orderId, timestamp: Date.now() }, { attempts: 5, backoff: { type: "exponential", delay: 2000 } });
      } else if (event.type as string === "ORDER_COMPLETED") {
        await domainEventsQueue.add("order_completed", { merchantId, customerId, orderId, timestamp: Date.now() }, { attempts: 5, backoff: { type: "exponential", delay: 2000 } });
      } else if (event.type as string === "MARK_SHIPPED") {
         // Just as an example, this might trigger inventory deductions 
         // but typically those are explicit tool actions. 
      }
      } catch (err) {
        console.error(\`[orderStateMachine] Redis publish failed for event \${event.type}:\`, err);
      }
    }`;

  const newCode = `    if (!("code" in result)) {
      // It's a successful transition
      try {
        await sql.begin(async (tx) => {
          await tx\`UPDATE orders SET state = \${sql.json(result as any)}, updated_at = NOW() WHERE id = \${orderId}\`;
          
          let eventType = null;
          if (event.type === "PAYMENT_CONFIRMED") eventType = "payment_confirmed";
          else if ((event.type as string) === "ORDER_COMPLETED") eventType = "order_completed";
          else if ((event.type as string) === "MARK_SHIPPED") eventType = "mark_shipped";
          
          if (eventType) {
            const payload = { merchantId, customerId, orderId, timestamp: Date.now() };
            await tx\`
              INSERT INTO outbox_events (event_type, payload, status, created_at)
              VALUES (\${eventType}, \${sql.json(payload as any)}, 'pending', NOW())
            \`;
          }
        });
      } catch (err) {
        throw new Error(\`Failed to update order state and outbox in DB: \${err}\`);
      }
    }`;

  content = content.replace(oldCode, newCode);
  fs.writeFileSync(file, content);
  console.log('Patched stateMachine');
}

patchPayment();
patchAgent();
patchStateMachine();
