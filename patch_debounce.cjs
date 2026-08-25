const fs = require('fs');
let code = fs.readFileSync('ace-whatsapp/core/comms-router/src/debounce.ts', 'utf8');

if (!code.includes('attempts: 3')) {
  // Update enqueueBiblioAgentMessage
  code = code.replace(
    /removeOnComplete: true\n    \}\n  \);/g,
    'removeOnComplete: true,\n      attempts: 3,\n      backoff: { type: "exponential", delay: 2000 }\n    }\n  );'
  );
  
  // Update worker error listeners
  code = code.replace(
    /export async function enqueueInboundMessage/g,
    `biblioWorker.on("error", (err) => logger.error("[BiblioWorker] Redis error:", err));\nbiblioWorker.on("failed", (job, err) => logger.error(\`[BiblioWorker] Job \${job?.id} failed:\`, err));\n\nturnWorker.on("error", (err) => logger.error("[TurnWorker] Redis error:", err));\nturnWorker.on("failed", (job, err) => logger.error(\`[TurnWorker] Job \${job?.id} failed:\`, err));\n\nexport async function enqueueInboundMessage`
  );
  
  fs.writeFileSync('ace-whatsapp/core/comms-router/src/debounce.ts', code, 'utf8');
}
