import fs from 'fs';
const path = 'ace-whatsapp/core/comms-router/src/outbound.ts';
let code = fs.readFileSync(path, 'utf8');

const aiLogSearch = `logger.log(\`[Outbound] Sending text to \${toPhone} (length: \${payload.text?.length})\`);`;
const aiLogReplace = `logger.log(\`[Outbound] Sending text to \${toPhone} (length: \${payload.text?.length})\`);
    
    // Log AI message to Expo Hub DB
    if (merchantId) {
      import('@ace/shared/clients.js').then(({ sql }) => {
        sql\`
          INSERT INTO conversation_messages (merchant_id, customer_id, source, content)
          VALUES (\${merchantId}, \${toPhone}, 'ai_agent', \${payload.text || '[Media]'})
        \`.catch(e => logger.error("[Outbound] Log failed", e));
      });
    }
`;

if (!code.includes("INSERT INTO conversation_messages")) {
  code = code.replace(aiLogSearch, aiLogReplace);
  fs.writeFileSync(path, code);
  console.log('Patched outbound.ts for AI logging.');
} else {
  console.log('Already patched outbound.ts');
}
