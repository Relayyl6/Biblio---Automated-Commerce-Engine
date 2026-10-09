const fs = require('fs');

function fix(file, oldStr, newStr) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(new RegExp(oldStr.replace(/\./g, '\\\\.'), 'g'), newStr);
  fs.writeFileSync(file, content);
}

fix('ace-whatsapp/core/ai-negotiator/src/tools/adminTools.ts', '../../supplier-integration', '../../../supplier-integration');
fix('ace-whatsapp/core/ai-negotiator/src/tools/adminTools.ts', '../../retention-engine', '../../../retention-engine');

fix('ace-whatsapp/core/event-orchestrator/src/flows/inventoryRestockFlow.ts', '../../supplier-integration', '../../../supplier-integration');

fix('ace-whatsapp/core/event-orchestrator/src/flows/nightlyRetentionFlow.ts', '../../retention-engine', '../../../retention-engine');

console.log('Fixed relative imports');
