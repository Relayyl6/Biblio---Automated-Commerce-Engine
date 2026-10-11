const fs = require('fs');
const file = 'ace-whatsapp/core/ai-negotiator/src/tools/index.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'export { bookingTools } from "./bookingTools.js";',
  'export { bookingTools } from "./bookingTools.js";\nexport { adminTools } from "./adminTools.js";'
);

content = content.replace(
  'import { inventoryTools, orderTools, crmTools, negotiationTools, financeTools, marketingTools, analyticsTools, settingsTools, integrationTools, bookingTools } from "./index.js";',
  'import { inventoryTools, orderTools, crmTools, negotiationTools, financeTools, marketingTools, analyticsTools, settingsTools, integrationTools, bookingTools, adminTools } from "./index.js";'
);

content = content.replace(
  '...bookingTools',
  '...bookingTools,\n  ...adminTools'
);

fs.writeFileSync(file, content);
console.log('Updated index.ts');
