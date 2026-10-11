const fs = require('fs');

function fix(file, oldStr, newStr) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.split(oldStr).join(newStr);
  fs.writeFileSync(file, content);
}

fix('ace-whatsapp/core/ai-negotiator/src/tools/adminTools.ts', '../../supplier-integration/src/gate.js', '../../../supplier-integration/src/gate.js');
fix('ace-whatsapp/core/ai-negotiator/src/tools/adminTools.ts', '../../retention-engine/src/gate.js', '../../../retention-engine/src/gate.js');

fix('ace-whatsapp/core/event-orchestrator/src/flows/inventoryRestockFlow.ts', '../../supplier-integration/src/index.js', '../../../supplier-integration/src/index.js');

fix('ace-whatsapp/core/event-orchestrator/src/flows/nightlyRetentionFlow.ts', '../../retention-engine/src/index.js', '../../../retention-engine/src/index.js');

console.log('Fixed relative imports');
