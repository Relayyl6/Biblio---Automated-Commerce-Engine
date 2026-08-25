const fs = require('fs');

// 1. Fix debounce.ts
let code = fs.readFileSync('ace-whatsapp/core/comms-router/src/debounce.ts', 'utf8');
if (!code.includes('import { logger } from "@ace/shared/logger.js"')) {
  code = `import { logger } from "@ace/shared/logger.js";\n` + code;
}
fs.writeFileSync('ace-whatsapp/core/comms-router/src/debounce.ts', code, 'utf8');

// 2. Fix outbound.ts (windowKey targetPhone is string | undefined but function requires string)
let outbound = fs.readFileSync('ace-whatsapp/core/comms-router/src/outbound.ts', 'utf8');
outbound = outbound.replace(/windowKey\(merchantId \?\? \"\", targetPhone\)/g, 'windowKey(merchantId ?? "", targetPhone || "")');
fs.writeFileSync('ace-whatsapp/core/comms-router/src/outbound.ts', outbound, 'utf8');

// 3. Fix event-orchestrator index.ts void returns
let eIdx = fs.readFileSync('ace-whatsapp/core/event-orchestrator/src/index.ts', 'utf8');
eIdx = eIdx.replace(/if \(paymentWorker\) await paymentWorker\.close\(\);\n    if \(cartWorker\)/g, 'if (cartWorker)');
eIdx = eIdx.replace(/if \(restockWorker\) await restockWorker\.close\(\);\n    if \(reviewWorker\)/g, 'if (reviewWorker)');
eIdx = eIdx.replace(/if \(loyaltyWorker\) await loyaltyWorker\.close\(\);\n    \n    process\.exit\(0\);/g, 'process.exit(0);');
fs.writeFileSync('ace-whatsapp/core/event-orchestrator/src/index.ts', eIdx, 'utf8');

// 4. Fix flows any job type
let pFlow = fs.readFileSync('ace-whatsapp/core/event-orchestrator/src/flows/postPaymentFlow.ts', 'utf8');
pFlow = pFlow.replace(/async \(job\) =>/g, 'async (job: any) =>');
pFlow = pFlow.replace(/\(job, err\)/g, '(job: any, err: any)');
pFlow = pFlow.replace(/\(err\)/g, '(err: any)');
fs.writeFileSync('ace-whatsapp/core/event-orchestrator/src/flows/postPaymentFlow.ts', pFlow, 'utf8');

let iFlow = fs.readFileSync('ace-whatsapp/core/event-orchestrator/src/flows/inventoryRestockFlow.ts', 'utf8');
iFlow = iFlow.replace(/async \(job\) =>/g, 'async (job: any) =>');
iFlow = iFlow.replace(/\(job, err\)/g, '(job: any, err: any)');
iFlow = iFlow.replace(/\(err\)/g, '(err: any)');
fs.writeFileSync('ace-whatsapp/core/event-orchestrator/src/flows/inventoryRestockFlow.ts', iFlow, 'utf8');
