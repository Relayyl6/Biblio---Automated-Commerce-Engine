const fs = require('fs');
let file = 'ace-whatsapp/core/event-orchestrator/src/flows/abandonedCartFlow.ts';
let content = fs.readFileSync(file, 'utf8');

const fix = `
const outboundQueue = new Queue("outbound-messages", {
  connection: { ...redis.options, maxRetriesPerRequest: null }
});

async function handleCartRecovery(orderId: string, merchantId: string, customerId: string) {
`;

content = content.replace(/async function handleCartRecovery\(orderId: string, merchantId: string, customerId: string\) \{/, fix);

content = content.replace(
  /const outboundQueue = new Queue\("outbound-messages", \{\n      connection: \{ \.\.\.redis\.options, maxRetriesPerRequest: null \}\n    \}\);\n    await outboundQueue\.add/g,
  'await outboundQueue.add'
);
content = content.replace(
  /const outboundQueue = new Queue\("outbound-messages", \{\n    connection: \{ \.\.\.redis\.options, maxRetriesPerRequest: null \}\n  \}\);\n  const customerText/g,
  'const customerText'
);

content = content.replace(/if \(!order\) return;/g, 'if (!order) { logger.warn(`Order ${orderId} not found`); return; }');

fs.writeFileSync(file, content);
console.log('Fixed abandonedCartFlow leak.');
