const fs = require('fs');
let content = fs.readFileSync('package.json', 'utf8');
content = content.replace(
  '"baileys-gateway": "tsx --env-file=.env ace-whatsapp/core/baileys-gateway/src/index.ts",',
  '"baileys-gateway": "tsx --env-file=.env ace-whatsapp/core/baileys-gateway/src/index.ts",\n    "event-orchestrator": "tsx --env-file=.env ace-whatsapp/core/event-orchestrator/src/index.ts",'
);
fs.writeFileSync('package.json', content);
console.log('Added event-orchestrator script.');
