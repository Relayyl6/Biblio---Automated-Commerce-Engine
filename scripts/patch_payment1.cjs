const fs = require('fs');
let file = 'ace-whatsapp/core/payment-verification/src/index.ts';
let content = fs.readFileSync(file, 'utf8');

// Fix 1: Redis Trap in handlePayment
content = content.replace(
  /const dedupeKey = \idempotency:payment:\$\{payment.providerRef\}\;\n  const isNew = await redis.set\(dedupeKey, \"1\", \"EX\", 60 \* 60 \* 24, \"NX\"\);\n  if \(\!isNew\) \{\n    app.log.info\(\{ providerRef: payment.providerRef \}, \"duplicate payment, skipping\"\);\n    return;\n  \}/g,
  \// Fast idempotency gate removed to prevent ghost drops on crash. 
  // We now rely solely on the DB's unique constraint on provider_ref.\
);

// Fix 6: Stateless Underpayments
const underpaymentFix = \sync function handleUnderpayment(order: MatchedOrder, payment: NormalizedPayment): Promise<void> {
  // Fix 6: Stateless Underpayments - fetch sum of all previous transactions
  const txRows = await sql\\\
    SELECT SUM(amount) as total_paid 
    FROM transactions 
    WHERE order_id = \$\{order.orderId\} 
      AND status != 'failed'
  \\\;
  
  const previousPaid = txRows.length > 0 && txRows[0].total_paid ? parseFloat(txRows[0].total_paid) : 0;
  
  // Note: we haven't inserted the CURRENT payment yet, so total_paid doesn't include it.
  const totalReceivedSoFar = previousPaid + payment.amountNgn;
  const balance = order.total - totalReceivedSoFar;

  // Insert current transaction
  await sql\\\
    insert into transactions
      (order_id, merchant_id, customer_id, amount, virtual_account, provider_ref, status)
    values (
      \$\{order.orderId\}, \$\{order.merchantId\}, \$\{order.customerId\},
      \$\{payment.amountNgn\}, \$\{payment.virtualAccount\}, \$\{payment.providerRef\}, 'underpaid'
    )
    on conflict (provider_ref) do nothing
  \\\;

  // Anomaly signal for TrustScore engine
  dataIntelligence.auditLog({
    service: "payment-verification",
    merchantId: order.merchantId,
    action: "underpayment_detected",
    metadata: {
      orderId: order.orderId,
      customerId: order.customerId,
      expected: order.total,
      received: totalReceivedSoFar,
      balance,
    },
  }).catch(err => app.log.error({ err, orderId: order.orderId, merchantId: order.merchantId }, "Telemetry auditLog for underpayment failed"));\;

content = content.replace(/async function handleUnderpayment[\s\S]*?\}\)\.catch\(err => app\.log\.error\([^)]+\), "[^"]+"\)\);/m, underpaymentFix);

fs.writeFileSync(file, content);
console.log('Patched payment-verification/src/index.ts part 1.');
