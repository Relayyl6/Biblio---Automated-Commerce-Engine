const fs = require('fs');
const file = 'ace-whatsapp/core/event-orchestrator/src/index.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'import { setupLoyaltyMilestoneFlow } from "./flows/loyaltyMilestoneFlow.js";',
  'import { setupLoyaltyMilestoneFlow } from "./flows/loyaltyMilestoneFlow.js";\nimport { setupNightlyRetentionFlow } from "./flows/nightlyRetentionFlow.js";'
);

content = content.replace(
  'const loyaltyWorker    = await setupLoyaltyMilestoneFlow();',
  'const loyaltyWorker    = await setupLoyaltyMilestoneFlow();\n  const retentionWorker  = await setupNightlyRetentionFlow();'
);

content = content.replace(
  'const allWorkers = [paymentWorker, cartWorker, restockWorker, reviewWorker, loyaltyWorker];',
  'const allWorkers = [paymentWorker, cartWorker, restockWorker, reviewWorker, loyaltyWorker, retentionWorker];'
);

fs.writeFileSync(file, content);

const pkgFile = 'ace-whatsapp/core/event-orchestrator/package.json';
let pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.dependencies['@ace/retention-engine'] = 'workspace:*';
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));

console.log('Updated index.ts and package.json');
