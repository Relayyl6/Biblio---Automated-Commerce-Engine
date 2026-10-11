const fs = require('fs');
const file = 'ace-whatsapp/core/ai-negotiator/src/toolHandlers.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'import { settingsHandlers } from "./tools/settingsTools.js";',
  'import { settingsHandlers } from "./tools/settingsTools.js";\nimport { adminHandlers } from "./tools/adminTools.js";'
);

content = content.replace(
  '...settingsHandlers,',
  '...settingsHandlers,\n  ...adminHandlers,'
);

fs.writeFileSync(file, content);
console.log('Updated toolHandlers.ts');
