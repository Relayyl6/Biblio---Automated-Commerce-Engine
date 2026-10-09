import fs from 'fs';
const path = 'ace-whatsapp/core/baileys-gateway/src/messageClassifier.ts';
let code = fs.readFileSync(path, 'utf8');

// The first patch might have failed or succeeded, let's just do a clean replace if needed.
const search = `
  if (isFromMe) {
    return; // Ignore messages sent by the business number itself
  }
`;

const replace = `
  if (isFromMe) {
    // Human operator (vendor) replied via their linked WhatsApp device!
    // We must pause the AI and log the message.
    const receiverJid = msg.key.remoteJid;
    if (receiverJid && !receiverJid.endsWith('@g.us') && receiverJid !== 'status@broadcast') {
      const customerId = jidToPhone(receiverJid);
      const merchantId = vendor.merchant_id;
      const content = extractRawText(msg);
      
      sql\`
        INSERT INTO conversation_messages (merchant_id, customer_id, source, content)
        VALUES (\${merchantId}, \${customerId}, 'human_operator', \${content})
      \`.catch(e => logger.error("Log failed", e));
      
      const arcKey = \`arc:\${merchantId}:\${customerId}\`;
      redis.get(arcKey).then(rawArc => {
        if (rawArc) {
          let arc = JSON.parse(rawArc);
          if (arc.stage !== 'paused') {
            arc.stage = 'paused';
            redis.setex(arcKey, 60 * 60 * 24, JSON.stringify(arc));
            logger.info(\`[MessageClassifier] Paused AI for customer \${customerId} due to manual vendor reply.\`);
          }
        }
      }).catch(e => logger.error("Arc pause failed", e));
    }
    return;
  }
`;

if (code.includes(search)) {
  code = code.replace(search, replace);
} else {
  // If we already patched with pubsub, replace pubsub with direct sql
  const pubsubSearch = `redis.publish('conversation_logs', JSON.stringify({
        merchantId, customerId, source: 'human_operator', content, timestamp: Date.now()
      })).catch(e => logger.error("Log failed", e));`;
      
  const pubsubReplace = `sql\`
        INSERT INTO conversation_messages (merchant_id, customer_id, source, content)
        VALUES (\${merchantId}, \${customerId}, 'human_operator', \${content})
      \`.catch(e => logger.error("Log failed", e));`;
      
  code = code.replace(pubsubSearch, pubsubReplace);
}

if (!code.includes('import { sql')) {
  code = code.replace('import { redis }', 'import { redis, sql }');
}

// Add Customer Logging to routeToNegotiator
const customerLogSearch = `await enqueueInboundMessage(inbound);`;
const customerLogReplace = `
  // Log customer message to Expo Hub DB
  sql\`
    INSERT INTO conversation_messages (merchant_id, customer_id, source, content)
    VALUES (\${vendor.merchant_id}, \${fromPhone}, 'customer', \${extractRawText(msg) || '[Media]'})
  \`.catch(e => logger.error("Log failed", e));

  await enqueueInboundMessage(inbound);
`;
if (!code.includes("INSERT INTO conversation_messages") || !code.includes("'customer'")) {
  code = code.replace(customerLogSearch, customerLogReplace);
}

fs.writeFileSync(path, code);
console.log('Patched messageClassifier for real direct SQL logging.');
